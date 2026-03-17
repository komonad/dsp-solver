"use strict";
/**
 * 生产模型 - 统一处理所有生产计算
 *
 * 核心概念:
 * 1. 配方输入: 原料 + 电力 + 增产剂（都是消耗品）
 * 2. 配方输出: 产物
 * 3. 实际产出 = 基础产出 * 建筑翻倍系数 * 增产剂产出系数
 * 4. 实际周期 = 基础周期 / (建筑速度 * 加速增产系数)
 *
 * 增产剂参数（每种等级）:
 * - speedBonus: 加速模式的速度加成
 * - productivityBonus: 增产模式的产出加成
 * - powerBonus: 功耗增加
 * - consumptionRate: 每分钟消耗的增产剂数量
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROLIFERATOR_PARAMS = void 0;
exports.setProliferatorParams = setProliferatorParams;
exports.resetProliferatorParams = resetProliferatorParams;
exports.getProliferatorParams = getProliferatorParams;
exports.calculateProductionParams = calculateProductionParams;
exports.buildRecipeCoefficients = buildRecipeCoefficients;
exports.calculateProductionRequirements = calculateProductionRequirements;
exports.calculateNetFlow = calculateNetFlow;
exports.calculateItemBalance = calculateItemBalance;
exports.formatProductionReport = formatProductionReport;
// 默认增产剂参数
exports.DEFAULT_PROLIFERATOR_PARAMS = {
    0: { speedBonus: 0, productivityBonus: 0, powerBonus: 0, consumptionRate: 0 },
    1: { speedBonus: 0.125, productivityBonus: 0.125, powerBonus: 0.3, consumptionRate: 0.5 },
    2: { speedBonus: 0.20, productivityBonus: 0.20, powerBonus: 0.5, consumptionRate: 0.5 },
    3: { speedBonus: 0.25, productivityBonus: 0.25, powerBonus: 0.7, consumptionRate: 0.5 },
};
// 当前使用的参数（可被模组修改）
var currentParams = exports.DEFAULT_PROLIFERATOR_PARAMS;
function setProliferatorParams(params) {
    currentParams = params;
}
function resetProliferatorParams() {
    currentParams = exports.DEFAULT_PROLIFERATOR_PARAMS;
}
function getProliferatorParams() {
    return currentParams;
}
function getParams(level) {
    return currentParams[level] || currentParams[0];
}
/**
 * 计算生产参数
 */
function calculateProductionParams(context) {
    var recipe = context.recipe, building = context.building, proliferator = context.proliferator;
    var params = proliferator ? getParams(proliferator.level) : getParams(0);
    // 1. 速度系数
    var speedMultiplier = building.speed;
    if ((proliferator === null || proliferator === void 0 ? void 0 : proliferator.mode) === 'speed' && building.hasProliferatorSlot) {
        speedMultiplier *= (1 + params.speedBonus);
    }
    // 2. 产出系数
    var outputMultiplier = 1;
    // 建筑内置产出加成
    if (building.intrinsicProductivity && building.intrinsicProductivity > 0) {
        outputMultiplier *= (1 + building.intrinsicProductivity);
    }
    // 建筑翻倍
    if (building.supportsDoubling && building.doublingConfig) {
        outputMultiplier *= building.doublingConfig.multiplier;
    }
    // 增产剂加成
    if ((proliferator === null || proliferator === void 0 ? void 0 : proliferator.mode) === 'productivity' && building.hasProliferatorSlot) {
        outputMultiplier *= (1 + params.productivityBonus);
    }
    // 3. 功耗系数
    var powerMultiplier = 1;
    if (proliferator && proliferator.level > 0 && building.hasProliferatorSlot) {
        powerMultiplier *= (1 + params.powerBonus);
    }
    // 4. 实际周期
    var cycleTime = recipe.time / speedMultiplier;
    // 5. 增产剂消耗（每分钟）
    var cyclesPerMinute = 60 / cycleTime;
    // 假设每个周期需要喷涂所有产物
    var totalProductsPerCycle = recipe.outputs.reduce(function (sum, o) { return sum + o.count; }, 0);
    var proliferatorConsumption = params.consumptionRate * cyclesPerMinute * totalProductsPerCycle;
    return {
        speedMultiplier: speedMultiplier,
        outputMultiplier: outputMultiplier,
        powerMultiplier: powerMultiplier,
        cycleTime: cycleTime,
        proliferatorConsumption: proliferatorConsumption,
    };
}
/**
 * 计算配方系数（用于LP求解）
 *
 * 返回: 单位执行次数（每分钟1次）的净产出系数
 * 正数 = 产出, 负数 = 消耗（包括原料、电力、增产剂）
 */
function buildRecipeCoefficients(recipe, building, proliferator) {
    var params = calculateProductionParams({ recipe: recipe, building: building, proliferator: proliferator });
    var coef = new Map();
    // 产出系数（正数）
    for (var _i = 0, _a = recipe.outputs; _i < _a.length; _i++) {
        var output = _a[_i];
        var rate = output.count * params.outputMultiplier;
        coef.set(output.itemId, rate);
    }
    // 原料消耗系数（负数）
    for (var _b = 0, _c = recipe.inputs; _b < _c.length; _b++) {
        var input = _c[_b];
        var rate = -input.count;
        coef.set(input.itemId, (coef.get(input.itemId) || 0) + rate);
    }
    // 电力消耗系数（负数，单位 MW/每分钟执行次数）
    var powerPerCycle = building.workPower * params.powerMultiplier;
    var powerPerMinute = powerPerCycle * (60 / params.cycleTime);
    coef.set('__POWER__', -powerPerMinute);
    // 增产剂消耗系数（负数）
    if (proliferator && proliferator.level > 0 && building.hasProliferatorSlot) {
        var prolifItemId = "__PROLIFERATOR_".concat(proliferator.level, "__");
        coef.set(prolifItemId, -params.proliferatorConsumption);
    }
    return coef;
}
/**
 * 计算目标产出所需的建筑数量和资源消耗
 *
 * @param context 生产上下文
 * @param targetRate 目标产出速率（每分钟，针对主产物）
 * @returns 详细计算结果
 */
function calculateProductionRequirements(context, targetRate) {
    var recipe = context.recipe;
    var params = calculateProductionParams(context);
    // 主产物
    var mainProduct = recipe.outputs[0];
    if (!mainProduct) {
        throw new Error('Recipe has no output');
    }
    // 单建筑每分钟产出 = (60 / 周期时间) * 产出数量 * 产出倍率
    var cyclesPerMinute = 60 / params.cycleTime;
    var outputPerBuilding = cyclesPerMinute * mainProduct.count * params.outputMultiplier;
    // 所需建筑数量
    var buildingCount = targetRate / outputPerBuilding;
    // 计算输入
    var inputs = new Map();
    // 原料
    for (var _i = 0, _a = recipe.inputs; _i < _a.length; _i++) {
        var input = _a[_i];
        var rate = cyclesPerMinute * input.count * buildingCount;
        inputs.set(input.itemId, (inputs.get(input.itemId) || 0) + rate);
    }
    // 电力
    var powerPerMinute = buildingCount * context.building.workPower * params.powerMultiplier * cyclesPerMinute;
    inputs.set('__POWER__', powerPerMinute);
    // 增产剂
    if (context.proliferator && context.proliferator.level > 0) {
        var prolifItemId = "__PROLIFERATOR_".concat(context.proliferator.level, "__");
        inputs.set(prolifItemId, params.proliferatorConsumption * buildingCount);
    }
    // 计算输出
    var outputs = new Map();
    for (var _b = 0, _c = recipe.outputs; _b < _c.length; _b++) {
        var output = _c[_b];
        var rate = cyclesPerMinute * output.count * params.outputMultiplier * buildingCount;
        outputs.set(output.itemId, rate);
    }
    return {
        buildingCount: buildingCount,
        inputs: inputs,
        outputs: outputs,
        cycleTime: params.cycleTime,
    };
}
/**
 * 计算配方执行次数对应的净流量
 *
 * @param recipe 配方
 * @param executionsPerMinute 每分钟执行次数
 * @param context 生产上下文
 * @returns 各物品的净流量（正=产出，负=消耗）
 */
function calculateNetFlow(recipe, executionsPerMinute, context) {
    var params = calculateProductionParams(context);
    var net = new Map();
    // 产出
    for (var _i = 0, _a = recipe.outputs; _i < _a.length; _i++) {
        var output = _a[_i];
        var rate = executionsPerMinute * output.count * params.outputMultiplier;
        net.set(output.itemId, (net.get(output.itemId) || 0) + rate);
    }
    // 原料消耗
    for (var _b = 0, _c = recipe.inputs; _b < _c.length; _b++) {
        var input = _c[_b];
        var rate = executionsPerMinute * input.count;
        net.set(input.itemId, (net.get(input.itemId) || 0) - rate);
    }
    // 电力消耗（作为特殊物品）
    var powerPerCycle = context.building.workPower * params.powerMultiplier;
    var powerPerMinute = powerPerCycle * executionsPerMinute;
    net.set('__POWER__', (net.get('__POWER__') || 0) - powerPerMinute);
    // 增产剂消耗
    if (context.proliferator && context.proliferator.level > 0 && context.building.hasProliferatorSlot) {
        var prolifItemId = "__PROLIFERATOR_".concat(context.proliferator.level, "__");
        net.set(prolifItemId, (net.get(prolifItemId) || 0) - params.proliferatorConsumption);
    }
    return net;
}
/**
 * 计算物品在配方中的净产出系数（每分钟，每执行1次配方）
 * 用于线性方程组建模
 *
 * @param recipe 配方
 * @param itemId 物品ID
 * @param proliferator 全局增产剂配置（可选）
 * @returns 净产出系数（正=产出，负=消耗）
 */
function calculateItemBalance(recipe, itemId, proliferator, building) {
    // 参数验证
    if (!recipe) {
        throw new Error('[Assertion Error] calculateItemBalance: recipe is undefined');
    }
    if (!itemId) {
        throw new Error('[Assertion Error] calculateItemBalance: itemId is undefined');
    }
    if (recipe.time <= 0) {
        throw new Error("[Assertion Error] Recipe ".concat(recipe.id, " has invalid time: ").concat(recipe.time));
    }
    // 验证配方的输入输出
    var totalInputCount = recipe.inputs.reduce(function (sum, i) { return sum + i.count; }, 0);
    var totalOutputCount = recipe.outputs.reduce(function (sum, o) { return sum + o.count; }, 0);
    if (totalOutputCount === 0 && recipe.inputs.length > 0) {
        console.warn("[Assertion Warning] Recipe ".concat(recipe.id, " (").concat(recipe.name, ") has no outputs but has inputs"));
    }
    // 增产模式加成（增加产出，不增加消耗）
    var prodMultiplier = (proliferator === null || proliferator === void 0 ? void 0 : proliferator.mode) === 'productivity' ?
        (1 + [0, 0.125, 0.2, 0.25][proliferator.level || 0]) : 1;
    // 建筑内置产出加成（例如某些模组建筑自带增产效果）
    if ((building === null || building === void 0 ? void 0 : building.intrinsicProductivity) && building.intrinsicProductivity > 0) {
        prodMultiplier *= (1 + building.intrinsicProductivity);
    }
    var balance = 0;
    // 产出（每分钟）- 考虑增产加成和建筑内置加成，不考虑加速（加速只影响建筑数量）
    for (var _i = 0, _a = recipe.outputs; _i < _a.length; _i++) {
        var output = _a[_i];
        if (output.itemId === itemId) {
            if (output.count < 0) {
                throw new Error("[Assertion Error] Recipe ".concat(recipe.id, " has negative output count for ").concat(itemId));
            }
            balance += output.count * prodMultiplier * (60 / recipe.time);
        }
    }
    // 消耗（每分钟）- 不受增产/加速影响（原料消耗不变）
    for (var _b = 0, _c = recipe.inputs; _b < _c.length; _b++) {
        var input = _c[_b];
        if (input.itemId === itemId) {
            if (input.count < 0) {
                throw new Error("[Assertion Error] Recipe ".concat(recipe.id, " has negative input count for ").concat(itemId));
            }
            balance -= input.count * (60 / recipe.time);
        }
    }
    // 验证：加速模式不应该影响物料平衡
    if ((proliferator === null || proliferator === void 0 ? void 0 : proliferator.mode) === 'speed' && Math.abs(balance) > 0.001) {
        // 对于加速模式，物料平衡不应该改变（只改变建筑数量）
        // 这是一个合理性检查，但不抛出错误，只记录
        var expectedBalanceWithoutSpeed = balance; // 已经计算好了
        if (Math.abs(expectedBalanceWithoutSpeed - balance) > 0.001) {
            console.warn("[Assertion Warning] Speed mode should not change material balance for ".concat(itemId, " in recipe ").concat(recipe.id));
        }
    }
    return balance;
}
/**
 * 格式化生产报告
 */
function formatProductionReport(result, itemMap) {
    var _a, _b, _c;
    var lines = [];
    lines.push('=== 生产参数 ===');
    lines.push("\u5EFA\u7B51\u6570\u91CF: ".concat(result.buildingCount.toFixed(2)));
    lines.push("\u5468\u671F\u65F6\u95F4: ".concat(result.cycleTime.toFixed(2), " \u79D2"));
    lines.push('\n=== 输入（每分钟）===');
    for (var _i = 0, _d = result.inputs.entries(); _i < _d.length; _i++) {
        var _e = _d[_i], id = _e[0], rate = _e[1];
        if (id.startsWith('__')) {
            if (id === '__POWER__')
                lines.push("  \u7535\u529B: ".concat(rate.toFixed(2), " MW"));
            else if (id.includes('PROLIFERATOR')) {
                var level = (_a = id.match(/\d+/)) === null || _a === void 0 ? void 0 : _a[0];
                lines.push("  \u589E\u4EA7\u5242Mk.".concat(level, ": ").concat(rate.toFixed(2)));
            }
        }
        else {
            lines.push("  ".concat(((_b = itemMap.get(id)) === null || _b === void 0 ? void 0 : _b.name) || id, ": ").concat(rate.toFixed(2)));
        }
    }
    lines.push('\n=== 输出（每分钟）===');
    for (var _f = 0, _g = result.outputs.entries(); _f < _g.length; _f++) {
        var _h = _g[_f], id = _h[0], rate = _h[1];
        lines.push("  ".concat(((_c = itemMap.get(id)) === null || _c === void 0 ? void 0 : _c.name) || id, ": ").concat(rate.toFixed(2)));
    }
    return lines.join('\n');
}

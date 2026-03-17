"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.solveMultiDemand = solveMultiDemand;
exports.collectUpstreamRecipes = collectUpstreamRecipes;
var productionModel_1 = require("./productionModel");
var yalps_1 = require("yalps");
/**
 * 求解多需求生产配平问题
 * 使用 yalps 线性求解器
 */
function solveMultiDemand(demands, gameData, options) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (options === void 0) { options = {}; }
    // 合并用户指定的原矿与游戏数据中的原矿
    var rawItemSet = new Set(__spreadArray(__spreadArray(__spreadArray([], gameData.rawItemIds, true), (gameData.defaultRawItemIds || []), true), (options.treatAsRaw || []), true));
    // 处理现有供给：计算净供给并调整需求
    var supplyMap = new Map(); // itemId -> net supply rate
    var existingSupplies = options.existingSupplies || [];
    for (var _i = 0, existingSupplies_1 = existingSupplies; _i < existingSupplies_1.length; _i++) {
        var supply = existingSupplies_1[_i];
        var current = supplyMap.get(supply.itemId) || 0;
        supplyMap.set(supply.itemId, current + supply.rate);
    }
    // 调整需求：扣除现有供给
    var adjustedDemands = [];
    var supplyContributions = new Map(); // 记录供给的贡献
    for (var _h = 0, demands_1 = demands; _h < demands_1.length; _h++) {
        var demand = demands_1[_h];
        // 如果需求物品被标记为原矿，不进入求解，直接由供给或外部输入满足
        if (rawItemSet.has(demand.itemId)) {
            var supply_1 = supplyMap.get(demand.itemId) || 0;
            supplyContributions.set(demand.itemId, Math.min(supply_1, demand.rate));
            // 剩余部分由外部原矿提供
            continue;
        }
        var supply = supplyMap.get(demand.itemId) || 0;
        var remaining = Math.max(0, demand.rate - supply);
        if (remaining > 0.001) {
            adjustedDemands.push({ itemId: demand.itemId, rate: remaining });
        }
        // 记录供给的贡献
        supplyContributions.set(demand.itemId, Math.min(supply, demand.rate));
        // 如果供给有剩余，标记为结余
        if (supply > demand.rate) {
            supplyContributions.set("__surplus_".concat(demand.itemId), supply - demand.rate);
        }
        // 从supplyMap中扣除已使用的部分
        if (supply > 0) {
            supplyMap.set(demand.itemId, Math.max(0, supply - demand.rate));
        }
    }
    // 记录非需求物品的供给贡献（如供给C来生产E）
    for (var _j = 0, supplyMap_1 = supplyMap; _j < supplyMap_1.length; _j++) {
        var _k = supplyMap_1[_j], itemId = _k[0], remainingSupply = _k[1];
        if (remainingSupply > 0.001 && !supplyContributions.has(itemId)) {
            supplyContributions.set(itemId, remainingSupply);
        }
    }
    // 1. 收集所有相关配方（从剩余需求向上游收集）
    var demandItemIds = adjustedDemands.map(function (d) { return d.itemId; });
    var selectedRecipes = options.selectedRecipes || new Map();
    var recipes = collectUpstreamRecipes(demandItemIds, gameData, rawItemSet, selectedRecipes);
    // 如果没有剩余需求（所有需求都被供给或标记为原矿）
    if (adjustedDemands.length === 0) {
        var finalSatisfiedDemands_1 = new Map();
        var rawMaterials_1 = new Map();
        for (var _l = 0, demands_2 = demands; _l < demands_2.length; _l++) {
            var demand = demands_2[_l];
            var supply = supplyContributions.get(demand.itemId) || 0;
            // 如果被标记为原矿，全部从外部输入，标记为满足
            if (rawItemSet.has(demand.itemId)) {
                finalSatisfiedDemands_1.set(demand.itemId, demand.rate);
                rawMaterials_1.set(demand.itemId, demand.rate);
            }
            else {
                // 否则由供给满足
                finalSatisfiedDemands_1.set(demand.itemId, Math.min(supply, demand.rate));
            }
        }
        return {
            feasible: true,
            recipes: new Map(),
            satisfiedDemands: finalSatisfiedDemands_1,
            intermediateBalance: new Map(),
            rawMaterials: rawMaterials_1,
            existingSupplyContribution: supplyContributions
        };
    }
    // 检查是否所有剩余需求都被标记为原矿
    var allDemandsAreRaw = demandItemIds.every(function (id) { return rawItemSet.has(id); });
    if (recipes.length === 0 && !allDemandsAreRaw) {
        return {
            feasible: false,
            message: '未找到相关配方',
            recipes: new Map(),
            satisfiedDemands: new Map(),
            intermediateBalance: new Map(),
            rawMaterials: new Map(),
            existingSupplyContribution: supplyContributions
        };
    }
    // 2. 收集所有涉及物品
    var allItems = new Set();
    for (var _m = 0, recipes_1 = recipes; _m < recipes_1.length; _m++) {
        var recipe = recipes_1[_m];
        for (var _o = 0, _p = recipe.inputs; _o < _p.length; _o++) {
            var input = _p[_o];
            allItems.add(input.itemId);
        }
        for (var _q = 0, _r = recipe.outputs; _q < _r.length; _q++) {
            var output = _r[_q];
            allItems.add(output.itemId);
        }
    }
    // 3. 构建 yalps 模型
    var items = Array.from(allItems);
    var adjustedDemandMap = new Map(adjustedDemands.map(function (d) { return [d.itemId, d.rate]; }));
    // 构建变量（配方）
    var variables = {};
    var objective = options.objective || 'min-buildings';
    var _loop_1 = function (recipe) {
        var varName = "r".concat(recipe.id);
        var coeffs = {};
        // 获取该配方使用的建筑
        var buildingId = (_a = options.recipeBuildings) === null || _a === void 0 ? void 0 : _a.get(recipe.id);
        var buildingIdStr = buildingId ? String(buildingId) : undefined;
        var building = buildingIdStr
            ? gameData.buildings.find(function (b) { return b.id === buildingIdStr; })
            : gameData.buildings.find(function (b) { return recipe.factoryIds.includes(b.originalId); });
        for (var _10 = 0, items_3 = items; _10 < items_3.length; _10++) {
            var itemId = items_3[_10];
            // 使用配方特定的增产剂配置，如果没有则使用全局配置
            var specificProlif = (_b = options.recipeProliferators) === null || _b === void 0 ? void 0 : _b.get(recipe.id);
            var prolif = specificProlif !== null && specificProlif !== void 0 ? specificProlif : options.globalProliferator;
            // 传入建筑以考虑内置产出加成
            var balance = (0, productionModel_1.calculateItemBalance)(recipe, itemId, prolif, building);
            if (Math.abs(balance) > 1e-12) {
                coeffs[itemId] = balance;
            }
        }
        var objectiveCost = 1;
        if (objective === 'min-power') {
            objectiveCost = (building === null || building === void 0 ? void 0 : building.workPower) || 1;
        }
        else if (objective === 'min-waste') {
            var rawInputCost = 0;
            for (var _11 = 0, _12 = recipe.inputs; _11 < _12.length; _11++) {
                var input = _12[_11];
                if (rawItemSet.has(input.itemId)) {
                    rawInputCost += input.count * (60 / recipe.time);
                }
            }
            objectiveCost = rawInputCost > 0 ? rawInputCost : 0.001;
        }
        coeffs._obj = objectiveCost;
        variables[varName] = coeffs;
    };
    for (var _s = 0, recipes_2 = recipes; _s < recipes_2.length; _s++) {
        var recipe = recipes_2[_s];
        _loop_1(recipe);
    }
    // 构建约束（使用调整后的需求）
    var constraints = {};
    var noByproducts = options.noByproducts || false;
    for (var _t = 0, items_1 = items; _t < items_1.length; _t++) {
        var itemId = items_1[_t];
        var demand = adjustedDemandMap.get(itemId);
        if (demand !== undefined) {
            // 需求物品：必须满足剩余需求
            constraints[itemId] = { min: demand };
        }
        else if (!rawItemSet.has(itemId)) {
            // 非需求且非原矿的物品（中间产物）
            if (noByproducts) {
                // 无副产物模式：必须完全平衡（产出 = 消耗）
                constraints[itemId] = { min: 0, max: 0 };
            }
            else {
                // 正常模式：不能从外部输入，允许结余
                constraints[itemId] = { min: 0 };
            }
        }
        // 原矿不做约束（允许从外部输入）
    }
    // 4. 求解
    var model = {
        direction: 'minimize',
        objective: '_obj',
        constraints: constraints,
        variables: variables,
    };
    var solution = (0, yalps_1.solve)(model);
    // 5. 解析结果
    var recipeCounts = new Map();
    var recipeRatesPerMinute = new Map();
    var satisfiedDemands = new Map();
    var intermediateBalance = new Map();
    var rawMaterials = new Map();
    if (solution.status !== 'optimal') {
        return {
            feasible: false,
            message: "\u6C42\u89E3\u5931\u8D25: ".concat(solution.status),
            recipes: recipeCounts,
            recipeRatesPerMinute: recipeRatesPerMinute,
            satisfiedDemands: satisfiedDemands,
            intermediateBalance: intermediateBalance,
            rawMaterials: rawMaterials
        };
    }
    // 提取建筑数量，并换算成每分钟执行次数
    var varMap = new Map(solution.variables);
    var _loop_2 = function (varName, value) {
        if (varName.startsWith('r') && value > 0.001) {
            var recipeId = varName.slice(1);
            recipeCounts.set(recipeId, value);
            var recipe_1 = gameData.recipeMap.get(recipeId);
            if (recipe_1) {
                var buildingId = (_c = options.recipeBuildings) === null || _c === void 0 ? void 0 : _c.get(recipe_1.id);
                var buildingIdStr_1 = buildingId ? String(buildingId) : undefined;
                var building = buildingIdStr_1
                    ? gameData.buildings.find(function (b) { return b.id === buildingIdStr_1; })
                    : gameData.buildings.find(function (b) { return recipe_1.factoryIds.includes(b.originalId); });
                var perBuildingExecutionsPerMinute = building ? building.speed * (60 / recipe_1.time) : (60 / recipe_1.time);
                recipeRatesPerMinute.set(recipeId, value * perBuildingExecutionsPerMinute);
            }
        }
    };
    for (var _u = 0, varMap_1 = varMap; _u < varMap_1.length; _u++) {
        var _v = varMap_1[_u], varName = _v[0], value = _v[1];
        _loop_2(varName, value);
    }
    // 初始化可行性验证变量
    var feasible = true;
    var message = '';
    // 计算各物品平衡
    for (var _w = 0, items_2 = items; _w < items_2.length; _w++) {
        var itemId = items_2[_w];
        var balance = 0;
        var varMap_2 = new Map(solution.variables);
        var _loop_3 = function (recipe) {
            var varName = "r".concat(recipe.id);
            var count = varMap_2.get(varName) || 0;
            if (count > 0.001) {
                // 使用配方特定的增产剂配置，如果没有则使用全局配置
                var specificProlif = (_d = options.recipeProliferators) === null || _d === void 0 ? void 0 : _d.get(recipe.id);
                var prolif = specificProlif !== null && specificProlif !== void 0 ? specificProlif : options.globalProliferator;
                // 获取该配方使用的建筑
                var buildingId = (_e = options.recipeBuildings) === null || _e === void 0 ? void 0 : _e.get(recipe.id);
                var buildingIdStr_2 = buildingId ? String(buildingId) : undefined;
                var building = buildingIdStr_2
                    ? gameData.buildings.find(function (b) { return b.id === buildingIdStr_2; })
                    : gameData.buildings.find(function (b) { return recipe.factoryIds.includes(b.originalId); });
                var coeff = (0, productionModel_1.calculateItemBalance)(recipe, itemId, prolif, building);
                balance += coeff * count;
            }
        };
        for (var _x = 0, recipes_3 = recipes; _x < recipes_3.length; _x++) {
            var recipe = recipes_3[_x];
            _loop_3(recipe);
        }
        var demand = adjustedDemandMap.get(itemId);
        var isRaw = rawItemSet.has(itemId);
        if (demand !== undefined) {
            // 需求物品
            satisfiedDemands.set(itemId, balance);
        }
        else if (isRaw) {
            // 被标记为原矿的物品：无论结余还是消耗，都放入 rawMaterials
            if (balance < -0.001) {
                // 净消耗
                rawMaterials.set(itemId, -balance);
            }
            else if (balance > 0.001) {
                // 净产出（结余）- 对于原矿，结余表示有外部输入后的剩余
                // 标记为负消耗（表示有资源可用）
                rawMaterials.set(itemId, 0); // 显示为0或可以单独标记为结余
            }
            // balance ≈ 0 则忽略
        }
        else if (balance < -0.001) {
            // 中间产物出现净消耗 - 这不应该发生，因为约束要求 >= 0
            // 标记为不可行
            feasible = false;
            message += "".concat(itemId, "\u751F\u4EA7\u4E0D\u8DB3: ").concat(balance.toFixed(2), "/min; ");
            // 仍然记录消耗以便调试
            rawMaterials.set(itemId, -balance);
        }
        else if (balance > 0.001) {
            // 中间产物结余
            intermediateBalance.set(itemId, balance);
        }
    }
    // 6. 合并现有供给的贡献到最终结果
    var finalSatisfiedDemands = new Map();
    // 对于原始需求，计算总满足量（供给 + 求解结果）
    for (var _y = 0, demands_3 = demands; _y < demands_3.length; _y++) {
        var demand = demands_3[_y];
        var supplyContribution = supplyContributions.get(demand.itemId) || 0;
        var solvedContribution = satisfiedDemands.get(demand.itemId) || 0;
        finalSatisfiedDemands.set(demand.itemId, supplyContribution + solvedContribution);
    }
    // 合并供给产生的中间产物结余
    for (var _z = 0, supplyContributions_1 = supplyContributions; _z < supplyContributions_1.length; _z++) {
        var _0 = supplyContributions_1[_z], key = _0[0], value = _0[1];
        if (key.startsWith('__surplus_')) {
            var itemId = key.slice(10);
            var current = intermediateBalance.get(itemId) || 0;
            intermediateBalance.set(itemId, current + value);
        }
    }
    // 7. 验证可行性（使用原始需求）
    var originalDemandMap = new Map(demands.map(function (d) { return [d.itemId, d.rate]; }));
    for (var _1 = 0, originalDemandMap_1 = originalDemandMap; _1 < originalDemandMap_1.length; _1++) {
        var _2 = originalDemandMap_1[_1], itemId = _2[0], demandRate = _2[1];
        var actual = finalSatisfiedDemands.get(itemId) || 0;
        if (actual < demandRate - 0.01) {
            feasible = false;
            message += "".concat(itemId, "\u9700\u6C42\u672A\u6EE1\u8DB3: ").concat(actual.toFixed(2), " < ").concat(demandRate, "; ");
        }
    }
    // 8. 断言验证：检查物料平衡的守恒性
    if (feasible) {
        // 重新计算所有配方的总产出/消耗，验证平衡
        var totalProduction = new Map();
        var totalConsumption = new Map();
        var _loop_4 = function (recipeId, count) {
            var recipe = gameData.recipeMap.get(recipeId);
            if (!recipe)
                return "continue";
            var specificProlif = (_f = options.recipeProliferators) === null || _f === void 0 ? void 0 : _f.get(recipeId);
            var prolif = specificProlif !== null && specificProlif !== void 0 ? specificProlif : options.globalProliferator;
            // 获取该配方使用的建筑（考虑内置产出加成）
            var buildingId = (_g = options.recipeBuildings) === null || _g === void 0 ? void 0 : _g.get(recipeId);
            var buildingIdStr = buildingId ? String(buildingId) : undefined;
            var building = buildingIdStr
                ? gameData.buildings.find(function (b) { return b.id === buildingIdStr; })
                : gameData.buildings.find(function (b) { return recipe.factoryIds.includes(b.originalId); });
            var intrinsicBonus = (building === null || building === void 0 ? void 0 : building.intrinsicProductivity) || 0;
            for (var _13 = 0, _14 = recipe.outputs; _13 < _14.length; _13++) {
                var output = _14[_13];
                var rate = output.count * count * (60 / recipe.time);
                if ((prolif === null || prolif === void 0 ? void 0 : prolif.mode) === 'productivity') {
                    var prodBonus = [0, 0.125, 0.2, 0.25][prolif.level || 0];
                    rate *= (1 + prodBonus);
                }
                if (intrinsicBonus > 0) {
                    rate *= (1 + intrinsicBonus);
                }
                totalProduction.set(output.itemId, (totalProduction.get(output.itemId) || 0) + rate);
            }
            for (var _15 = 0, _16 = recipe.inputs; _15 < _16.length; _15++) {
                var input = _16[_15];
                var rate = input.count * count * (60 / recipe.time);
                totalConsumption.set(input.itemId, (totalConsumption.get(input.itemId) || 0) + rate);
            }
        };
        for (var _3 = 0, recipeCounts_1 = recipeCounts; _3 < recipeCounts_1.length; _3++) {
            var _4 = recipeCounts_1[_3], recipeId = _4[0], count = _4[1];
            _loop_4(recipeId, count);
        }
        // 验证每个需求的净产出 >= 需求
        for (var _5 = 0, originalDemandMap_2 = originalDemandMap; _5 < originalDemandMap_2.length; _5++) {
            var _6 = originalDemandMap_2[_5], itemId = _6[0], demandRate = _6[1];
            var production = totalProduction.get(itemId) || 0;
            var consumption = totalConsumption.get(itemId) || 0;
            var netProduction = production - consumption;
            // 检查原矿消耗是否合理
            var rawConsumption = rawMaterials.get(itemId) || 0;
            var totalAvailable = netProduction + rawConsumption;
            if (Math.abs(totalAvailable - demandRate) > 0.1 && !rawItemSet.has(itemId)) {
                console.warn("[Assertion Warning] ".concat(itemId, " \u4EA7\u51FA/\u6D88\u8017\u4E0D\u5339\u914D:"), {
                    需求: demandRate,
                    净产出: netProduction,
                    原矿输入: rawConsumption,
                    可用总量: totalAvailable,
                    差额: totalAvailable - demandRate
                });
            }
        }
        // 验证中间产物的平衡（非原矿、非需求的物品）
        for (var _7 = 0, intermediateBalance_1 = intermediateBalance; _7 < intermediateBalance_1.length; _7++) {
            var _8 = intermediateBalance_1[_7], itemId = _8[0], balance = _8[1];
            if (originalDemandMap.has(itemId) || rawItemSet.has(itemId))
                continue;
            var production = totalProduction.get(itemId) || 0;
            var consumption = totalConsumption.get(itemId) || 0;
            var calculatedBalance = production - consumption;
            if (Math.abs(balance - calculatedBalance) > 0.01) {
                console.warn("[Assertion Warning] ".concat(itemId, " \u4E2D\u95F4\u4EA7\u7269\u7ED3\u4F59\u8BA1\u7B97\u4E0D\u4E00\u81F4:"), {
                    记录结余: balance,
                    计算结余: calculatedBalance,
                    产出: production,
                    消耗: consumption
                });
            }
        }
    }
    // 8. 处理被标记为原矿的需求物品（它们没有进入求解，需要在这里标记为满足）
    for (var _9 = 0, demands_4 = demands; _9 < demands_4.length; _9++) {
        var demand = demands_4[_9];
        if (rawItemSet.has(demand.itemId) && !finalSatisfiedDemands.has(demand.itemId)) {
            var supply = supplyContributions.get(demand.itemId) || 0;
            finalSatisfiedDemands.set(demand.itemId, Math.min(supply, demand.rate));
            // 剩余部分算外部原矿输入
            if (supply < demand.rate) {
                var needFromExternal = demand.rate - supply;
                rawMaterials.set(demand.itemId, (rawMaterials.get(demand.itemId) || 0) + needFromExternal);
            }
        }
    }
    return {
        feasible: feasible,
        message: message || undefined,
        recipes: recipeCounts,
        recipeRatesPerMinute: recipeRatesPerMinute,
        satisfiedDemands: finalSatisfiedDemands,
        intermediateBalance: intermediateBalance,
        rawMaterials: rawMaterials,
        existingSupplyContribution: supplyContributions
    };
}
/**
 * 收集上游配方（BFS遍历）
 * @param stopAtItems 遇到这些物品停止向上游收集（视为原矿）
 * @param selectedRecipes 强制指定的配方选择
 */
function collectUpstreamRecipes(targetItemIds, gameData, stopAtItems, selectedRecipes) {
    var visited = new Set();
    var queue = __spreadArray([], targetItemIds, true);
    var recipes = [];
    var _loop_5 = function () {
        var itemId = queue.shift();
        if (visited.has(itemId))
            return "continue";
        // 标记为已访问
        visited.add(itemId);
        // 如果是原矿，停止向上收集（不找生产它的配方）
        if (stopAtItems === null || stopAtItems === void 0 ? void 0 : stopAtItems.has(itemId)) {
            return "continue";
        }
        // 找产出该物品的配方
        var producingRecipes = void 0;
        // 检查是否有强制指定的配方
        var selectedRecipeId = selectedRecipes === null || selectedRecipes === void 0 ? void 0 : selectedRecipes.get(itemId);
        if (selectedRecipeId) {
            // 只使用指定的配方
            var selectedRecipe = gameData.recipeMap.get(selectedRecipeId);
            producingRecipes = selectedRecipe ? [selectedRecipe] : [];
        }
        else {
            // 使用所有能生产该物品的配方（排除无中生有配方）
            producingRecipes = gameData.recipes.filter(function (r) {
                if (!r.outputs.some(function (o) { return o.itemId === itemId; }))
                    return false;
                // 排除无中生有配方（无输入但有输出，且配方名称以"[无中生有]"开头）
                if (r.inputs.length === 0 && r.name.startsWith('[无中生有]'))
                    return false;
                return true;
            });
        }
        var _loop_6 = function (recipe) {
            if (!recipes.find(function (r) { return r.id === recipe.id; })) {
                recipes.push(recipe);
                // 将该配方的所有输入加入队列
                for (var _a = 0, _b = recipe.inputs; _a < _b.length; _a++) {
                    var input = _b[_a];
                    if (!visited.has(input.itemId)) {
                        queue.push(input.itemId);
                    }
                }
            }
        };
        for (var _i = 0, producingRecipes_1 = producingRecipes; _i < producingRecipes_1.length; _i++) {
            var recipe = producingRecipes_1[_i];
            _loop_6(recipe);
        }
    };
    while (queue.length > 0) {
        _loop_5();
    }
    return recipes;
}

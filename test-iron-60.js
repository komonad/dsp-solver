"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var loader_1 = require("./src/data/loader");
var multiDemandSolver_1 = require("./src/core/multiDemandSolver");
var autoBuilding_1 = require("./src/core/autoBuilding");
var resultModel_1 = require("./src/web/resultModel");
function test60IronPlate() {
    return __awaiter(this, void 0, void 0, function () {
        var gameData, ironPlateItem, ironPlateRecipe, demands, recipeBuildings, result, model;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('=== 测试案例：vanilla配置下需求60铁块 ===');
                    return [4 /*yield*/, (0, loader_1.loadGameDataFromFile)('./data/Vanilla.json')];
                case 1:
                    gameData = _b.sent();
                    console.log('✅ 加载Vanilla配置成功');
                    ironPlateItem = gameData.items.find(function (item) { return item.name === '铁块'; });
                    ironPlateRecipe = gameData.recipes.find(function (recipe) { return recipe.name === '铁块'; });
                    if (!ironPlateItem || !ironPlateRecipe) {
                        console.error('❌ 未找到铁块物品或配方');
                        return [2 /*return*/];
                    }
                    console.log("\u94C1\u5757\u7269\u54C1ID: ".concat(ironPlateItem.id));
                    console.log("\u94C1\u5757\u914D\u65B9ID: ".concat(ironPlateRecipe.id));
                    console.log("\u94C1\u5757\u914D\u65B9: \u6BCF\u6B21\u6D88\u8017".concat(ironPlateRecipe.inputs[0].amount, "\u4E2A").concat((_a = gameData.itemMap.get(ironPlateRecipe.inputs[0].itemId)) === null || _a === void 0 ? void 0 : _a.name, "\uFF0C\u4EA7\u51FA").concat(ironPlateRecipe.outputs[0].amount, "\u4E2A\u94C1\u5757\uFF0C\u8017\u65F6").concat(ironPlateRecipe.time, "\u79D2"));
                    demands = [{ itemId: ironPlateItem.id, rate: 60 }];
                    recipeBuildings = (0, autoBuilding_1.buildLayeredRecipeBuildings)(gameData, demands.map(function (d) { return d.itemId; }));
                    console.log('\n开始求解，需求: 60铁块/分钟');
                    result = (0, multiDemandSolver_1.solveMultiDemand)(demands, gameData, {
                        treatAsRaw: [],
                        existingSupplies: [],
                        selectedRecipes: new Map(),
                        noByproducts: false,
                        recipeProliferators: new Map(),
                        recipeBuildings: recipeBuildings,
                    });
                    console.log("\u6C42\u89E3\u7ED3\u679C: ".concat(result.feasible ? '成功' : '失败'));
                    if (result.feasible) {
                        console.log('\n=== 求解器返回的原始数据 ===');
                        console.log('配方速率:', Object.fromEntries(result.recipeRatesPerMinute || result.recipes));
                        console.log('原料消耗:', Object.fromEntries(result.rawMaterials));
                        console.log('满足的需求:', Object.fromEntries(result.satisfiedDemands));
                        model = (0, resultModel_1.buildResultModel)(result, gameData, recipeBuildings);
                        console.log('\n=== 结果模型计算的展示数据 ===');
                        model.recipes.forEach(function (recipe) {
                            if (recipe.recipeId === ironPlateRecipe.id) {
                                console.log("\u914D\u65B9: ".concat(recipe.recipeName));
                                console.log("\u6267\u884C\u6B21\u6570: ".concat(recipe.executionsPerMinute.toFixed(2), "/\u5206\u949F"));
                                console.log("\u5EFA\u7B51\u6570\u91CF: ".concat(recipe.buildingCount.toFixed(2), "\u4E2A ").concat(recipe.buildingName));
                                console.log("\u5355\u5EFA\u7B51\u6267\u884C\u6B21\u6570: ".concat(recipe.perBuildingExecutionsPerMinute.toFixed(2), "/\u5206\u949F"));
                                console.log('输入:', recipe.inputs.map(function (i) { return "".concat(i.itemName, ": ").concat(i.rate.toFixed(2), "/\u5206\u949F"); }));
                                console.log('输出:', recipe.outputs.map(function (o) { return "".concat(o.itemName, ": ").concat(o.rate.toFixed(2), "/\u5206\u949F"); }));
                            }
                        });
                        console.log('\n原料列表:');
                        model.rawMaterials.forEach(function (raw) {
                            console.log("".concat(raw.itemName, ": ").concat(raw.rate.toFixed(2), "/\u5206\u949F"));
                        });
                    }
                    else {
                        console.error('求解失败:', result.message);
                    }
                    return [2 /*return*/];
            }
        });
    });
}
test60IronPlate();

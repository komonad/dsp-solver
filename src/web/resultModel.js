"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildResultModel = buildResultModel;
var productionModel_1 = require("../core/productionModel");
function buildResultModel(result, gameData, recipeBuildings) {
    var recipes = [];
    var recipeRates = result.recipeRatesPerMinute || result.recipes;
    var _loop_1 = function (recipeId, executionsPerMinute) {
        var recipe = gameData.recipeMap.get(recipeId);
        if (!recipe)
            return "continue";
        var buildingId = recipeBuildings.get(recipeId) || String(recipe.factoryIds[0]);
        var building = gameData.buildings.find(function (b) { return b.id === buildingId || String(b.originalId) === buildingId; });
        if (!building)
            return "continue";
        var perBuildingExecutionsPerMinute = building.speed * (60 / recipe.time);
        var buildingCount = perBuildingExecutionsPerMinute > 0 ? executionsPerMinute / perBuildingExecutionsPerMinute : 0;
        var netFlow = (0, productionModel_1.calculateNetFlow)(recipe, executionsPerMinute, { recipe: recipe, building: building });
        recipes.push({
            recipeId: recipeId,
            recipeName: recipe.name,
            buildingId: building.id,
            buildingName: building.name,
            executionsPerMinute: executionsPerMinute,
            perBuildingExecutionsPerMinute: perBuildingExecutionsPerMinute,
            buildingCount: buildingCount,
            inputs: recipe.inputs.map(function (input) {
                var _a;
                return ({
                    itemId: input.itemId,
                    itemName: ((_a = gameData.itemMap.get(input.itemId)) === null || _a === void 0 ? void 0 : _a.name) || input.itemId,
                    rate: Math.abs(Math.min(netFlow.get(input.itemId) || 0, 0)),
                });
            }),
            outputs: recipe.outputs.map(function (output) {
                var _a;
                return ({
                    itemId: output.itemId,
                    itemName: ((_a = gameData.itemMap.get(output.itemId)) === null || _a === void 0 ? void 0 : _a.name) || output.itemId,
                    rate: Math.max(netFlow.get(output.itemId) || 0, 0),
                });
            }),
        });
    };
    for (var _i = 0, _a = recipeRates.entries(); _i < _a.length; _i++) {
        var _b = _a[_i], recipeId = _b[0], executionsPerMinute = _b[1];
        _loop_1(recipeId, executionsPerMinute);
    }
    return {
        recipes: recipes,
        rawMaterials: Array.from(result.rawMaterials.entries()).map(function (_a) {
            var _b;
            var itemId = _a[0], rate = _a[1];
            return ({
                itemId: itemId,
                itemName: ((_b = gameData.itemMap.get(itemId)) === null || _b === void 0 ? void 0 : _b.name) || itemId,
                rate: rate,
            });
        }),
    };
}

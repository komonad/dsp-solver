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
exports.buildLayeredRecipeBuildings = buildLayeredRecipeBuildings;
function collectProductivityCriticalRecipes(gameData, demandItemIds) {
    var criticalRecipes = new Set();
    var visitedItems = new Set();
    var queue = __spreadArray([], demandItemIds, true);
    while (queue.length > 0) {
        var itemId = queue.shift();
        if (visitedItems.has(itemId))
            continue;
        visitedItems.add(itemId);
        for (var _i = 0, _a = gameData.itemToRecipes.get(itemId) || []; _i < _a.length; _i++) {
            var recipe = _a[_i];
            if (criticalRecipes.has(recipe.id))
                continue;
            criticalRecipes.add(recipe.id);
            for (var _b = 0, _c = recipe.inputs; _b < _c.length; _b++) {
                var input = _c[_b];
                if (!gameData.defaultRawItemIds.includes(input.itemId)) {
                    queue.push(input.itemId);
                }
            }
        }
    }
    return criticalRecipes;
}
function buildLayeredRecipeBuildings(gameData, demandItemIds) {
    var result = new Map();
    var buildingsByCategory = new Map();
    for (var _i = 0, _a = gameData.buildings; _i < _a.length; _i++) {
        var building = _a[_i];
        if (!buildingsByCategory.has(building.category)) {
            buildingsByCategory.set(building.category, []);
        }
        buildingsByCategory.get(building.category).push(building);
    }
    for (var _b = 0, buildingsByCategory_1 = buildingsByCategory; _b < buildingsByCategory_1.length; _b++) {
        var _c = buildingsByCategory_1[_b], buildings = _c[1];
        buildings.sort(function (a, b) { return (a.intrinsicProductivity || 0) - (b.intrinsicProductivity || 0); });
    }
    var targetRecipes = collectProductivityCriticalRecipes(gameData, demandItemIds);
    var _loop_1 = function (recipe) {
        var defaultBuilding = gameData.buildings.find(function (b) { return recipe.factoryIds.includes(b.originalId); });
        if (!defaultBuilding)
            return "continue";
        var categoryBuildings = buildingsByCategory.get(defaultBuilding.category) || [];
        var picked = void 0;
        if (targetRecipes.has(recipe.id)) {
            picked = categoryBuildings[categoryBuildings.length - 1];
        }
        else {
            picked = categoryBuildings.find(function (b) { return !(b.intrinsicProductivity && b.intrinsicProductivity > 0); }) || categoryBuildings[0];
        }
        if (picked) {
            result.set(recipe.id, picked.id);
        }
    };
    for (var _d = 0, _e = gameData.recipes; _d < _e.length; _d++) {
        var recipe = _e[_d];
        _loop_1(recipe);
    }
    return result;
}

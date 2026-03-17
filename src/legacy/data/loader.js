"use strict";
/**
 * 鏁版嵁鍔犺浇鍣?- 浠巇sp-calc鏍煎紡鍔犺浇娓告垙鏁版嵁
 */
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
exports.loadGameData = loadGameData;
exports.loadGameDataFromFile = loadGameDataFromFile;
exports.loadGameDataFromURL = loadGameDataFromURL;
// 鍘熺増寤虹瓚瀹氫箟锛圛D鏉ヨ嚜娓告垙锛?
var VANILLA_BUILDINGS = {
    // 鐔旂倝
    2302: { name: '电弧熔炉', nameCN: '电弧熔炉', category: 'smelter', speed: 1, workPower: 0.36, idlePower: 0.012, hasProliferatorSlot: true },
    2315: { name: '位面熔炉', nameCN: '位面熔炉', category: 'smelter', speed: 2, workPower: 0.72, idlePower: 0.024, hasProliferatorSlot: true },
    2319: { name: '负熵熔炉', nameCN: '负熵熔炉', category: 'smelter', speed: 3, workPower: 1.08, idlePower: 0.036, hasProliferatorSlot: true },
    // 鍒堕€犲彴
    2303: { name: '制造台 Mk.I', nameCN: '制造台 Mk.I', category: 'assembler', speed: 0.75, workPower: 0.27, idlePower: 0.009, hasProliferatorSlot: true },
    2304: { name: '制造台 Mk.II', nameCN: '制造台 Mk.II', category: 'assembler', speed: 1, workPower: 0.54, idlePower: 0.018, hasProliferatorSlot: true },
    2305: { name: '制造台 Mk.III', nameCN: '制造台 Mk.III', category: 'assembler', speed: 1.5, workPower: 1.08, idlePower: 0.036, hasProliferatorSlot: true },
    2318: { name: '重组式制造台', nameCN: '重组式制造台', category: 'assembler', speed: 2, workPower: 2.16, idlePower: 0.072, hasProliferatorSlot: true },
    // 绮剧偧鍘?
    2308: { name: '原油精炼厂', nameCN: '原油精炼厂', category: 'refinery', speed: 1, workPower: 0.96, idlePower: 0.032, hasProliferatorSlot: true },
    // 鍖栧伐鍘?
    2309: { name: '化工厂', nameCN: '化工厂', category: 'chemical', speed: 1, workPower: 0.72, idlePower: 0.024, hasProliferatorSlot: true },
    2313: { name: '低温化工厂', nameCN: '低温化工厂', category: 'chemical', speed: 1, workPower: 0.9, idlePower: 0.03, hasProliferatorSlot: true, intrinsicProductivity: 0.25 },
    2314: { name: '量子化工厂', nameCN: '量子化工厂', category: 'chemical', speed: 1, workPower: 1.44, idlePower: 0.048, hasProliferatorSlot: true, intrinsicProductivity: 1.0 },
    // 瀵规挒鏈?
    2310: { name: '微型粒子对撞机', nameCN: '微型粒子对撞机', category: 'particle', speed: 1, workPower: 12, idlePower: 0.4, hasProliferatorSlot: true },
    // 鐮旂┒绔?
    2901: { name: '矩阵研究站', nameCN: '矩阵研究站', category: 'lab', speed: 1, workPower: 0.48, idlePower: 0.016, hasProliferatorSlot: true },
    2902: { name: '自演化研究站', nameCN: '自演化研究站', category: 'lab', speed: 3, workPower: 1.44, idlePower: 0.048, hasProliferatorSlot: true },
    // 鍏朵粬
    2307: { name: '采油机', nameCN: '采油机', category: 'extractor', speed: 1, workPower: 0.42, idlePower: 0.014, hasProliferatorSlot: false },
    2306: { name: '水泵', nameCN: '水泵', category: 'pump', speed: 1, workPower: 0.03, idlePower: 0.001, hasProliferatorSlot: false },
    2311: { name: '分馏塔', nameCN: '分馏塔', category: 'fractionator', speed: 1, workPower: 0.72, idlePower: 0.024, hasProliferatorSlot: true },
    2312: { name: '轨道采集器', nameCN: '轨道采集器', category: 'orbital', speed: 1, workPower: 0, idlePower: 0, hasProliferatorSlot: false },
    2301: { name: '采矿机', nameCN: '采矿机', category: 'mining', speed: 0.5, workPower: 0.42, idlePower: 0.014, hasProliferatorSlot: false },
    2316: { name: '大型采矿机', nameCN: '大型采矿机', category: 'mining', speed: 2, workPower: 2.94, idlePower: 0.098, hasProliferatorSlot: false },
};
// 鍘熺熆绫诲瀷ID鍒楄〃锛圱ype 1锛?
var RAW_ITEM_TYPES = new Set([1]);
/**
 * 鍔犺浇娓告垙鏁版嵁
 * @param rawData 鍘熷JSON鏁版嵁
 * @returns 瑙ｆ瀽鍚庣殑娓告垙鏁版嵁
 */
function loadGameData(rawData) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    // 杞崲鐗╁搧 - 鏀寔澶у皬鍐欎袱绉嶆牸寮?
    var items = rawData.items.map(function (raw) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        return ({
            id: ((_b = (_a = raw.ID) !== null && _a !== void 0 ? _a : raw.id) !== null && _b !== void 0 ? _b : 0).toString(),
            name: (_d = (_c = raw.Name) !== null && _c !== void 0 ? _c : raw.name) !== null && _d !== void 0 ? _d : '鏈煡鐗╁搧',
            originalId: (_f = (_e = raw.ID) !== null && _e !== void 0 ? _e : raw.id) !== null && _f !== void 0 ? _f : 0,
            type: (_h = (_g = raw.Type) !== null && _g !== void 0 ? _g : raw.type) !== null && _h !== void 0 ? _h : 0,
            iconName: (_k = (_j = raw.IconName) !== null && _j !== void 0 ? _j : raw.iconName) !== null && _k !== void 0 ? _k : '',
            isRaw: RAW_ITEM_TYPES.has((_m = (_l = raw.Type) !== null && _l !== void 0 ? _l : raw.type) !== null && _m !== void 0 ? _m : 0),
        });
    });
    // 杞崲閰嶆柟 - 鏀寔澶у皬鍐欎袱绉嶆牸寮?
    var recipes = rawData.recipes.map(function (raw) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1;
        // 濡傛灉宸茬粡鏈?inputs/outputs 鏁扮粍锛堣嚜瀹氫箟鏍煎紡锛夛紝鐩存帴浣跨敤
        var inputs;
        var outputs;
        if (raw.inputs && raw.outputs) {
            if (raw.inputs.length > 0 && typeof raw.inputs[0] === 'object') {
                inputs = raw.inputs;
            }
            else {
                var inputIds = raw.inputs;
                var inputCounts_1 = (_a = raw.inputCounts) !== null && _a !== void 0 ? _a : [];
                inputs = inputIds.map(function (id, index) { return ({
                    itemId: id.toString(),
                    count: inputCounts_1[index] || 0,
                }); });
            }
            if (raw.outputs.length > 0 && typeof raw.outputs[0] === 'object') {
                outputs = raw.outputs;
            }
            else {
                var outputIds = raw.outputs;
                var outputCounts_1 = (_b = raw.outputCounts) !== null && _b !== void 0 ? _b : [];
                outputs = outputIds.map(function (id, index) { return ({
                    itemId: id.toString(),
                    count: outputCounts_1[index] || 0,
                }); });
            }
        }
        else {
            // dsp-calc 鏍煎紡锛圴anilla.json锛?
            var items_1 = (_d = (_c = raw.Items) !== null && _c !== void 0 ? _c : raw.items) !== null && _d !== void 0 ? _d : [];
            var itemCounts_1 = (_f = (_e = raw.ItemCounts) !== null && _e !== void 0 ? _e : raw.itemCounts) !== null && _f !== void 0 ? _f : [];
            var results = (_h = (_g = raw.Results) !== null && _g !== void 0 ? _g : raw.results) !== null && _h !== void 0 ? _h : [];
            var resultCounts_1 = (_k = (_j = raw.ResultCounts) !== null && _j !== void 0 ? _j : raw.resultCounts) !== null && _k !== void 0 ? _k : [];
            inputs = items_1.map(function (id, index) { return ({
                itemId: id.toString(),
                count: itemCounts_1[index] || 0,
            }); });
            outputs = results.map(function (id, index) { return ({
                itemId: id.toString(),
                count: resultCounts_1[index] || 0,
            }); });
        }
        var factories = (_m = (_l = raw.Factories) !== null && _l !== void 0 ? _l : raw.factoryIds) !== null && _m !== void 0 ? _m : [];
        var category = raw.category;
        return {
            id: ((_p = (_o = raw.ID) !== null && _o !== void 0 ? _o : raw.id) !== null && _p !== void 0 ? _p : 0).toString(),
            name: (_r = (_q = raw.Name) !== null && _q !== void 0 ? _q : raw.name) !== null && _r !== void 0 ? _r : '鏈煡閰嶆柟',
            originalId: (_t = (_s = raw.ID) !== null && _s !== void 0 ? _s : raw.id) !== null && _t !== void 0 ? _t : 0,
            inputs: inputs,
            outputs: outputs,
            time: raw.TimeSpend !== undefined
                ? raw.TimeSpend / 60
                : ((_u = raw.time) !== null && _u !== void 0 ? _u : 60),
            factoryIds: factories,
            category: category,
            isMultiProduct: (_v = raw.isMultiProduct) !== null && _v !== void 0 ? _v : (outputs.length > 1),
            proliferatorLevel: (_x = (_w = raw.Proliferator) !== null && _w !== void 0 ? _w : raw.proliferatorLevel) !== null && _x !== void 0 ? _x : 0,
            iconName: (_z = (_y = raw.IconName) !== null && _y !== void 0 ? _y : raw.iconName) !== null && _z !== void 0 ? _z : '',
            type: (_1 = (_0 = raw.Type) !== null && _0 !== void 0 ? _0 : raw.type) !== null && _1 !== void 0 ? _1 : 0,
        };
    });
    // 杞崲寤虹瓚 - 鏀寔鑷畾涔夋牸寮忕殑 buildings 鏁扮粍
    var buildings = [];
    // 濡傛灉鏈夎嚜瀹氫箟 buildings 鏁扮粍锛圧efinery.json锛夛紝鐩存帴浣跨敤
    if (rawData.buildings) {
        for (var _i = 0, _p = rawData.buildings; _i < _p.length; _i++) {
            var raw = _p[_i];
            var buildingId = (_b = (_a = raw.id) !== null && _a !== void 0 ? _a : raw.originalId) !== null && _b !== void 0 ? _b : 0;
            buildings.push({
                id: buildingId.toString(),
                originalId: (_d = (_c = raw.originalId) !== null && _c !== void 0 ? _c : parseInt(raw.id)) !== null && _d !== void 0 ? _d : 0,
                name: (_e = raw.name) !== null && _e !== void 0 ? _e : '鏈煡寤虹瓚',
                category: raw.category || 'other',
                speed: (_f = raw.speed) !== null && _f !== void 0 ? _f : 1,
                workPower: (_g = raw.workPower) !== null && _g !== void 0 ? _g : 0,
                idlePower: (_h = raw.idlePower) !== null && _h !== void 0 ? _h : 0,
                hasProliferatorSlot: (_j = raw.hasProliferatorSlot) !== null && _j !== void 0 ? _j : false,
                supportsDoubling: (_k = raw.supportsDoubling) !== null && _k !== void 0 ? _k : false,
                intrinsicProductivity: raw.intrinsicProductivity,
            });
        }
    }
    else {
        var _loop_1 = function (id, config) {
            var buildingId = parseInt(id);
            // 妫€鏌ユ寤虹瓚鏄惁琚换浣曢厤鏂逛娇鐢?
            var isUsed = recipes.some(function (r) { return r.factoryIds.includes(buildingId); });
            if (isUsed) {
                buildings.push({
                    id: buildingId.toString(),
                    originalId: buildingId,
                    name: config.name || "\u5BE4\u8679\u74DA".concat(buildingId),
                    category: config.category || 'other',
                    speed: config.speed || 1,
                    workPower: config.workPower || 0,
                    idlePower: config.idlePower || 0,
                    hasProliferatorSlot: config.hasProliferatorSlot || false,
                    supportsDoubling: false, // 鍘熺増榛樿涓嶆敮鎸?
                });
            }
        };
        // 浣跨敤鍘熺増寤虹瓚瀹氫箟锛圴anilla.json锛?
        for (var _q = 0, _r = Object.entries(VANILLA_BUILDINGS); _q < _r.length; _q++) {
            var _s = _r[_q], id = _s[0], config = _s[1];
            _loop_1(id, config);
        }
    }
    // 鏋勫缓鏄犲皠
    var itemMap = new Map(items.map(function (i) { return [i.id, i]; }));
    var recipeMap = new Map(recipes.map(function (r) { return [r.id, r]; }));
    // 鏋勫缓鐗╁搧鍒伴厤鏂圭殑鏄犲皠
    var itemToRecipes = new Map();
    for (var _t = 0, recipes_1 = recipes; _t < recipes_1.length; _t++) {
        var recipe = recipes_1[_t];
        for (var _u = 0, _v = recipe.outputs; _u < _v.length; _u++) {
            var output = _v[_u];
            if (!itemToRecipes.has(output.itemId)) {
                itemToRecipes.set(output.itemId, []);
            }
            itemToRecipes.get(output.itemId).push(recipe);
        }
    }
    var producibleItemIds = new Set();
    for (var _w = 0, recipes_2 = recipes; _w < recipes_2.length; _w++) {
        var recipe = recipes_2[_w];
        for (var _x = 0, _y = recipe.outputs; _x < _y.length; _x++) {
            var output = _y[_x];
            producibleItemIds.add(output.itemId);
        }
    }
    // 鑾峰彇鍘熺熆ID鍒楄〃 - 浼樺厛浣跨敤鑷畾涔夋牸寮忎腑鐨?rawItemIds
    var configuredRawItemIds = (_l = rawData.rawItemIds) !== null && _l !== void 0 ? _l : items.filter(function (i) { return i.isRaw; }).map(function (i) { return i.id; });
    var defaultRawItemIds = Array.from(new Set(__spreadArray(__spreadArray([], ((_m = rawData.defaultRawItemIds) !== null && _m !== void 0 ? _m : []), true), items.filter(function (i) { return !producibleItemIds.has(i.id); }).map(function (i) { return i.id; }), true)));
    var rawItemIds = Array.from(new Set(__spreadArray(__spreadArray([], configuredRawItemIds, true), defaultRawItemIds, true)));
    return {
        version: (_o = rawData.version) !== null && _o !== void 0 ? _o : '0.10.x',
        items: items,
        recipes: recipes,
        buildings: buildings,
        proliferators: [
            { level: 0, name: 'None', speedBonus: 0, productivityBonus: 0, sprayCount: 0 },
            { level: 1, name: 'Proliferator Mk.I', speedBonus: 0.125, productivityBonus: 0.125, sprayCount: 12 },
            { level: 2, name: 'Proliferator Mk.II', speedBonus: 0.20, productivityBonus: 0.20, sprayCount: 12 },
            { level: 3, name: 'Proliferator Mk.III', speedBonus: 1.0, productivityBonus: 1.0, sprayCount: 12 },
        ],
        rawItemIds: rawItemIds,
        defaultRawItemIds: defaultRawItemIds,
        itemMap: itemMap,
        recipeMap: recipeMap,
        itemToRecipes: itemToRecipes,
    };
}
/**
 * 浠庢枃浠跺姞杞芥父鎴忔暟鎹?
 * @param filePath JSON鏂囦欢璺緞
 * @returns 瑙ｆ瀽鍚庣殑娓告垙鏁版嵁
 */
function loadGameDataFromFile(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var fs, content, cleanContent, rawData;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('fs/promises'); })];
                case 1:
                    fs = _a.sent();
                    return [4 /*yield*/, fs.readFile(filePath, 'utf-8')];
                case 2:
                    content = _a.sent();
                    cleanContent = content.replace(/^\uFEFF/, '');
                    rawData = JSON.parse(cleanContent);
                    return [2 /*return*/, loadGameData(rawData)];
            }
        });
    });
}
/**
 * 浠嶶RL鍔犺浇娓告垙鏁版嵁锛堟祻瑙堝櫒鐜锛?
 * @param url JSON鏂囦欢URL
 * @returns 瑙ｆ瀽鍚庣殑娓告垙鏁版嵁
 */
function loadGameDataFromURL(url) {
    return __awaiter(this, void 0, void 0, function () {
        var response, content, cleanContent, rawData;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fetch(url)];
                case 1:
                    response = _a.sent();
                    return [4 /*yield*/, response.text()];
                case 2:
                    content = _a.sent();
                    cleanContent = content.replace(/^\uFEFF/, '');
                    rawData = JSON.parse(cleanContent);
                    return [2 /*return*/, loadGameData(rawData)];
            }
        });
    });
}

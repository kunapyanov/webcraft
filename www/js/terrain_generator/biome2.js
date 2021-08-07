importScripts(
    '../vendors/perlin.js',
    '../vendors/alea.js'
);

class Map {

    // Private properties
    #aleaRandom = null;
    #chunk      = null;

    // Constructor
    constructor(chunk, options) {
        this.options        = options;
        this.trees          = [];
        this.plants         = [];
        this.cells          = Array(chunk.size.x).fill(null).map(el => Array(chunk.size.z).fill(null));
        this.#aleaRandom    = new alea(chunk.seed + '_' + chunk.id);
        this.#chunk         = chunk;
    }

    smooth(generator) {
    
        const SMOOTH_RAD = 3;

        let neighbour_map = null;
        let map = null;

        // Smoothing | Сглаживание
        for(var x = 0 - SMOOTH_RAD; x < this.#chunk.size.x + SMOOTH_RAD; x++) {
            for(var z = 0 - SMOOTH_RAD; z < this.#chunk.size.z + SMOOTH_RAD; z++) {
                // absolute cell coord
                let px      = this.#chunk.coord.x + x;
                let pz      = this.#chunk.coord.z + z;
                // calc chunk addr for this cell
                let addr    = new Vector(parseInt(px / CHUNK_SIZE_X), 0, parseInt(pz / CHUNK_SIZE_Z));
                // get chunk map from cache
                let map_addr_ok = map && (map.#chunk.addr.x == addr.x) && (map.#chunk.addr.z == addr.z);
                if(!map || !map_addr_ok) {
                    map = generator.maps_cache[addr];
                }
                let cell = map.cells[px - map.#chunk.coord.x][pz - map.#chunk.coord.z];
                if(cell.value > this.options.WATER_LINE - 2 && [BIOMES.OCEAN.code, BIOMES.BEACH.code].indexOf(cell.biome.code) >= 0) {
                    continue;
                }
                let height_sum  = 0;
                let cnt         = 0;
                let dirt_color  = new Color(0, 0, 0, 0);
                for(var i = -SMOOTH_RAD; i <= SMOOTH_RAD; i++) {
                    for(var j = -SMOOTH_RAD; j <= SMOOTH_RAD; j++) {
                        cnt++;
                        // calc chunk addr for this cell
                        let neighbour_addr  = new Vector(parseInt((px + i) / CHUNK_SIZE_X), 0, parseInt((pz + j) / CHUNK_SIZE_Z));
                        var addr_ok = neighbour_map &&
                                      (neighbour_map.#chunk.addr.x == neighbour_addr.x) &&
                                      (neighbour_map.#chunk.addr.z == neighbour_addr.z);
                        if(!neighbour_map || !addr_ok) {
                            neighbour_map = generator.maps_cache[neighbour_addr.toString()];
                        }
                        let neighbour_cell  = neighbour_map.cells[px + i - neighbour_map.#chunk.coord.x][pz + j - neighbour_map.#chunk.coord.z];
                        height_sum += neighbour_cell.value;
                        dirt_color.add(neighbour_cell.biome.dirt_color);
                    }
                }
                cell.value2           = parseInt(height_sum / cnt);
                cell.biome.dirt_color = dirt_color.divide(new Color(cnt, cnt, cnt, cnt));
            }
        }

    }

    // Генерация растительности
    generateVegetation() {
        let chunk       = this.#chunk;
        let aleaRandom  = this.#aleaRandom;
        this.trees      = [];
        this.plants     = [];
        for(var x = 0; x < chunk.size.x; x++) {
            for(var z = 0; z < chunk.size.z; z++) {
                let cell = this.cells[x][z];
                let biome = BIOMES[cell.biome.code];
                let y = cell.value2;
                // Если наверху блок земли
                let dirt_block_ids = biome.dirt_block.map(function(item) {return item.id;});
                if(dirt_block_ids.indexOf(cell.block.id) >= 0) {
                    // Динамическая рассадка растений
                    var rnd = aleaRandom.double();
                    if(rnd > 0 && rnd <= biome.plants.frequency) {
                        var s = 0;
                        var r = rnd / biome.plants.frequency;
                        for(var p of biome.plants.list) {
                            s += p.percent;
                            if(r < s) {
                                this.plants.push({
                                    pos: new Vector(x, y, z),
                                    block: p.block
                                });
                                break;
                            }
                        }
                    }
                    // Посадка деревьев
                    if(rnd > 0 && rnd <= biome.trees.frequency) {   
                        var s = 0;
                        var r = rnd / biome.trees.frequency;
                        for(var type of biome.trees.list) {
                            s += type.percent;
                            if(r < s) {
                                const height = Helpers.clamp(Math.round(aleaRandom.double() * type.height.max), type.height.min, type.height.max);
                                const rad = Math.max(parseInt(height / 2), 2);
                                this.trees.push({
                                    pos:    new Vector(x, y, z),
                                    height: height,
                                    rad:    rad,
                                    type:   type
                                });
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

}

class MapCell {

    constructor(value, humidity, equator, biome, block) {
        this.value      = value;
        this.value2     = value;
        this.humidity   = humidity;
        this.equator    = equator;
        this.biome      = biome;
        this.block      = block;
    }

}

// Terrain generator class
class Terrain_Generator {

    constructor(seed) {
        const scale                 = .5;
        // Настройки
        this.options = {
            WATER_LINE:             63, // Ватер-линия
            SCALE_EQUATOR:          1280 * scale, // Масштаб для карты экватора
            SCALE_BIOM:             640  * scale, // Масштаб для карты шума биомов
            SCALE_HUMIDITY:         320  * scale, // Масштаб для карты шума влажности
            SCALE_VALUE:            250  * scale // Масштаб шума для карты высот
        };
        //
        this.seed                   = seed;
        this.noisefn                = noise.perlin2;
        this.maps_cache             = {};
        noise.seed(this.seed);
    }

    // generateMap
    generateMap(chunk, noisefn) {
        if(this.maps_cache.hasOwnProperty(chunk.id)) {
            return this.maps_cache[chunk.addr.toString()];
        }
        const options               = this.options;
        const SX                    = chunk.coord.x;
        const SZ                    = chunk.coord.z;
        // Result map
        var map                     = new Map(chunk, this.options);
        //
        for(var x = 0; x < chunk.size.x; x++) {
            for(var z = 0; z < chunk.size.z; z++) {
                var px = SX + x;
                var pz = SZ + z;
                let value = noisefn(px / 150, pz / 150, 0) * .4 + 
                    noisefn(px / 1650, pz / 1650) * .1 +
                    noisefn(px / 650, pz / 650) * .25 +
                    noisefn(px / 20, pz / 20) * .05 +
                    noisefn(px / 350, pz / 350) * .5;
                value += noisefn(px / 25, pz / 25) * (4 / 255 * noisefn(px / 20, pz / 20));
                // Влажность
                var humidity = Helpers.clamp((noisefn(px / options.SCALE_HUMIDITY, pz / options.SCALE_HUMIDITY) + 0.8) / 2);
                // Экватор
                var equator = Helpers.clamp((noisefn(px / options.SCALE_EQUATOR, pz / options.SCALE_EQUATOR) + 0.8) / 1);
                // Get biome
                var biome = BIOMES.getBiome((value * 64 + 68) / 255, humidity, equator);
                value = value * biome.max_height + 68;
                value = parseInt(value);
                value = Helpers.clamp(value, 4, 255);
                biome = BIOMES.getBiome(value / 255, humidity, equator);
                // Pow
                var diff = value - options.WATER_LINE;
                if(diff < 0) {
                    value -= (options.WATER_LINE - value) * .65 - 1.5;
                    // value = (options.WATER_LINE + diff * .7);
                } else {
                    value = options.WATER_LINE + Math.pow(diff, 1 + diff / 64);
                }
                value = parseInt(value);
                // Different dirt blocks
                var ns = noisefn(px / 5, pz / 5);
                let index = parseInt(biome.dirt_block.length * Helpers.clamp(Math.abs(ns + .3), 0, .999));
                var dirt_block = biome.dirt_block[index];
                // Create map cell
                map.cells[x][z] = new MapCell(
                    value,
                    humidity,
                    equator,
                    {
                        code:           biome.code,
                        color:          biome.color,
                        dirt_color:     biome.dirt_color,
                        title:          biome.title,
                        dirt_block:     dirt_block,
                        block:          biome.block
                    },
                    dirt_block
                );
                if(biome.code == 'OCEAN') {
                    map.cells[x][z].block = blocks.STILL_WATER;
                }

            }
        }
        // Clear maps_cache
        var entrs = Object.entries(this.maps_cache);
        var MAX_ENTR = 2000;
        if(entrs.length > MAX_ENTR) {
            var del_count = Math.floor(entrs.length - MAX_ENTR * 0.333);
            console.info('Clear maps_cache, del_count: ' + del_count);
            for(const [k, v] of entrs) {
                if(--del_count == 0) {
                    break;
                }
                delete(this.maps_cache[k]);
            }
        }
        //
        return this.maps_cache[chunk.addr.toString()] = map;
    }

    // generateMaps
    generateMaps(chunk) {

        const noisefn               = this.noisefn;
        var maps                    = [];
        var map                     = null;

        for(var x = -1; x <= 1; x++) {
            for(var z = -1; z <= 1; z++) {
                const addr = new Vector(chunk.addr.x + x, chunk.addr.y, chunk.addr.z + z);
                const c = {
                    blocks: {},
                    seed: chunk.seed,
                    addr: addr,
                    size: new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z),
                    coord: new Vector(addr.x * CHUNK_SIZE_X, addr.y * CHUNK_SIZE_Y, addr.z * CHUNK_SIZE_Z),
                };
                c.id = [c.addr.x, c.addr.y, c.addr.z, c.size.x, c.size.y, c.size.z].join('_');
                var item = {
                    chunk: c,
                    info: this.generateMap(c, noisefn)
                };
                maps.push(item);
                if(x == 0 && z == 0) {
                    map = item;
                }            
            }
        }

        // Smooth (for central and part of neighboors)
        map.info.smooth(this);

        // Generate vegetation
        for(var map of maps) {
            map.info.generateVegetation();
        }

        return maps;
    }

    // Generate
    generate(chunk) {

        var maps = this.generateMaps(chunk);
        var map = maps[4];
        
        const seed                  = chunk.id;
        const seedn                 = 0;
        const amplitude             = 24;
        const noiseScale            = 15;
        const aleaRandom            = new alea(seed);
        const noisefn               = this.noisefn;

        //
        for(var x = 0; x < chunk.size.x; x++) {
            for(var z = 0; z < chunk.size.z; z++) {

                // AIR
                chunk.blocks[x][z] = Array(chunk.size.y).fill(null);

                // Bedrock
                chunk.blocks[x][z][0] = blocks.BEDROCK;

                const cell  = map.info.cells[x][z];
                const biome = cell.biome;
                const value = cell.value2;

                var ar      = aleaRandom.double();
                var rnd     = ar;

                // Sin wave
                //var px = (x + chunk.coord.x);
                //var pz = (z + chunk.coord.z);
                //for(var y = 4; y < 4 + Math.abs((Math.sin(px / 8) + Math.cos(pz / 8)) * 3); y++) {
                //    chunk.blocks[x][z][y] = blocks.CONCRETE;
                //}

                for(var y = 1; y < value; y++) {

                    // Caves | Пещеры
                    if(y > 5 && ['OCEAN', 'BEACH'].indexOf(biome.code) < 0) {
                        let px          = (x + chunk.coord.x);
                        let py          = (y + chunk.coord.y);
                        let pz          = (z + chunk.coord.z);
                        let xNoise      = noisefn(py / noiseScale, pz / noiseScale) * amplitude;
                        let yNoise      = noisefn(px / noiseScale, pz / noiseScale) * amplitude;
                        let zNoise      = noisefn(px / noiseScale, py / noiseScale) * amplitude;
                        let density     = xNoise + yNoise + zNoise + (py / 4);
                        if (density < 2 || density > 97) {
                            // Чтобы не удалять землю из под деревьев
                            var near_tree = false;
                            for(let m of maps) {
                                for(let tree of m.info.trees) {
                                    if(tree.pos.distance(new Vector(px - m.chunk.coord.x, py - m.chunk.coord.y, pz - m.chunk.coord.z)) < 5) {
                                        near_tree = true;
                                        break;
                                    }
                                }
                            }
                            if(!near_tree) {
                                continue;
                            }
                        }
                    }

                    // Ores (если это не вода, то заполняем полезными ископаемыми)
                    if(y < value - (rnd < .005 ? 0 : 3)) {
                        var r = aleaRandom.double() * 1.33;
                        if(r < 0.0025 && y < value - 5) {
                            chunk.blocks[x][z][y] = blocks.DIAMOND_ORE;
                        } else if(r < 0.01) {
                            chunk.blocks[x][z][y] = blocks.COAL_ORE;
                        } else {
                            var norm = true;
                            for(var plant of map.info.plants) {
                                if(plant.pos.x == x && plant.pos.z == z && y == plant.pos.y - 1) {
                                    norm = false;
                                    break;
                                }
                            }
                            chunk.blocks[x][z][y] = norm ? blocks.CONCRETE : biome.dirt_block;
                        }
                    } else {
                        chunk.blocks[x][z][y] = biome.dirt_block;
                    }
                }

                if(biome.code == 'OCEAN') {
                    chunk.blocks[x][z][map.info.options.WATER_LINE] = blocks.STILL_WATER;
                }

            }
        }

        /*
        const tree_types = [
            {style: 'spruce', trunk: blocks.SPRUCE, leaves: blocks.SPRUCE_LEAVES, height: 7},
            {style: 'wood', trunk: blocks.WOOD, leaves: blocks.WOOD_LEAVES, height: 5},
            {style: 'stump', trunk: blocks.WOOD, leaves: blocks.RED_MUSHROOM, height: 1},
            {style: 'cactus', trunk: blocks.CACTUS, leaves: null, height: 5},
        ];

        var x = 8;
        var z = 8;
        var type = tree_types[chunk.addr.x % tree_types.length];
        var tree_options = {
            type: type,
            height: type.height,
            rad: 4,
            pos: new Vector(x, 2, z)
        };
        this.plantTree(
            tree_options,
            chunk,
            tree_options.pos.x,
            tree_options.pos.y,
            tree_options.pos.z,
        );

        return map;
        */

        // Remove herbs and trees on air
        /*
        map.info.trees = map.info.trees.filter(function(item, index, arr) {
            let block = chunk.blocks[item.pos.x][item.pos.z][item.pos.y - 1];
            return block && block.id != blocks.AIR.id;
        });
        */

        // Plant herbs
        for(var p of map.info.plants) {
            var b = chunk.blocks[p.pos.x][p.pos.z][p.pos.y - 1];
            if(b && b.id == blocks.DIRT.id) {
                chunk.blocks[p.pos.x][p.pos.z][p.pos.y] = p.block;
            }
        }

        // Plant trees
        for(const m of maps) {
            for(var p of m.info.trees) {
                this.plantTree(
                    p,
                    chunk,
                    m.chunk.coord.x + p.pos.x - chunk.coord.x,
                    m.chunk.coord.y + p.pos.y - chunk.coord.y,
                    m.chunk.coord.z + p.pos.z - chunk.coord.z
                );
            }
        }

        return map;

    }

    // plantTree...
    plantTree(options, chunk, x, y, z) {
        const height        = options.height;
        const type          = options.type;
        var ystart = y + height;
        // ствол
        for(var p = y; p < ystart; p++) {
            if(chunk.getBlock(x + chunk.coord.x, p + chunk.coord.y, z + chunk.coord.z).id >= 0) {
                if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z) {
                    chunk.blocks[x][z][p] = type.trunk;
                }
            }
        }
        // листва над стволом
        switch(type.style) {
            case 'cactus': {
                // кактус
                break;
            }
            case 'stump': {
                // пенёк
                if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z) {
                    chunk.blocks[x][z][ystart] = type.leaves;
                }
                break;
            }
            case 'wood': {
                // дуб, берёза
                var py = y + height;
                for(var rad of [1, 1, 2, 2]) {
                    for(var i = x - rad; i <= x + rad; i++) {
                        for(var j = z - rad; j <= z + rad; j++) {
                            if(i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z) {
                                var m = (i == x - rad && j == z - rad) ||
                                    (i == x + rad && j == z + rad) || 
                                    (i == x - rad && j == z + rad) ||
                                    (i == x + rad && j == z - rad);
                                var m2 = (py == y + height) ||
                                    (i + chunk.coord.x + j + chunk.coord.z + py) % 3 > 0;
                                if(m && m2) {
                                    continue;
                                }
                                var b = chunk.blocks[i][j][py];
                                if(!b || b.id >= 0 && b.id != type.trunk.id) {
                                    chunk.blocks[i][j][py] = type.leaves;
                                }
                            }
                        }
                    }
                    py--;
                }
                break;
            }
            case 'acacia': {
                // акация
                var py = y + height;
                for(var rad of [2, 3]) {
                    for(var i = x - rad; i <= x + rad; i++) {
                        for(var j = z - rad; j <= z + rad; j++) {
                            if(i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z) {
                                if(Helpers.distance(new Vector(x, 0, z), new Vector(i, 0, j)) > rad) {
                                    continue;
                                }
                                var b = chunk.blocks[i][j][py];
                                if(!b || b.id >= 0 && b.id != type.trunk.id) {
                                    chunk.blocks[i][j][py] = type.leaves;
                                }
                            }
                        }
                    }
                    py--;
                }
                break;
            }
            case 'spruce': {
                // ель
                var r = 1;
                var rad = Math.round(r);
                if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z) {
                    chunk.blocks[x][z][ystart] = type.leaves;
                }
                var step = 0;
                for(var y = ystart - 1; y > ystart - (height - 1); y--) {
                    if(step++ % 2 == 0) {
                        rad = Math.min(Math.round(r), 3);
                    } else {
                        rad = 1;
                    }
                    for(var i = x - rad; i <= x + rad; i++) {
                        for(var j = z - rad; j <= z + rad; j++) {
                            if(i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z) {
                                if(rad == 1 || Math.sqrt(Math.pow(x - i, 2) + Math.pow(z - j, 2)) <= rad) {
                                    var b = chunk.getBlock(i + chunk.coord.x, p + chunk.coord.y, j + chunk.coord.z);
                                    if(b.id == blocks.AIR.id) {
                                        chunk.blocks[i][j][y] = type.leaves;
                                    }
                                }
                            }
                        }
                    }
                    r += .9;
                }
                break;
            }
        }
    }

}
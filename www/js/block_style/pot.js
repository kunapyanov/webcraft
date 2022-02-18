import {DIRECTION} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk.js";
import {impl as alea} from "../../vendors/alea.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;

const WIDTH =  6 / 16;
const HEIGHT = 5 / 16;

const WIDTH_INNER = 4/16;
const HEIGHT_INNER = 1/16;

const RANDOM_FLOWERS = [
    BLOCK.DANDELION.id,
    BLOCK.FLOWER_ALLIUM.id,
    BLOCK.FLOWER_BLUE_ORCHID.id,
    BLOCK.FLOWER_OXEYE_DAISY.id,
    BLOCK.FLOWER_LILY_OF_THE_VALLEY.id,
    BLOCK.BROWN_MUSHROOM.id,
    BLOCK.RED_MUSHROOM.id
];

let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

class FakeBlock {

    constructor(id, extra_data, pos, rotate, pivot, matrix, tags) {
        this.id = id;
        this.extra_data = extra_data;
        this.pos = pos;
        this.rotate = rotate;
        this.tags = tags;
        this.pivot = pivot;
        this.matrix = matrix;
    }

    getCardinalDirection() {
        return BLOCK.getCardinalDirection(this.rotate);
    }

    hasTag(tag) {
        if(!Array.isArray(this.tags)) {
            return false;
        }
        return this.tags.indexOf(tag) >= 0;
    }

    get material() {
        return BLOCK.fromId(this.id);
    }

};

// Горшок
export default class style {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['pot'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {
        let aabb = new AABB();
        aabb.set(
            0 + .5 - WIDTH / 2,
            0,
            0 + .5 - WIDTH / 2,
            0 + .5 + WIDTH / 2,
            0 + HEIGHT,
            0 + .5 + WIDTH / 2,
        );
        aabb.pad(1/32)
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        // Textures
        const c_top = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_side = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_down = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_inner_down = BLOCK.calcMaterialTexture(block.material, DIRECTION.DOWN);

        c_side[1] += 11/32/32;
        c_down[1] += 10/32/32;

        let aabb = new AABB();
        aabb.set(
            x + .5 - WIDTH / 2,
            y + .6,
            z + .5 - WIDTH / 2,
            x + .5 + WIDTH / 2,
            y + .6 + HEIGHT,
            z + .5 + WIDTH / 2,
        );

        matrix = mat4.create();
        // mat4.rotateY(matrix, matrix, ((block.rotate.x - 2) / 4) * -(2 * Math.PI));

        // Center
        let aabb_down = new AABB();
        aabb_down.set(
            x + .5 - WIDTH/2,
            y,
            z + .5 - WIDTH/2,
            x + .5 + WIDTH/2,
            y + HEIGHT,
            z + .5 + WIDTH/2,
        );

        // Push vertices down
        pushAABB(
            vertices,
            aabb_down,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_top, 0, 1), // flag: 0, anim: 1 implicit 
                down:   new AABBSideParams(c_down, 0, 1),
                south:  new AABBSideParams(c_side, 0, 1),
                north:  new AABBSideParams(c_side, 0, 1),
                west:   new AABBSideParams(c_side, 0, 1),
                east:   new AABBSideParams(c_side, 0, 1),
            },
            true,
            new Vector(x, y, z)
        );

        // Inner
        aabb_down.set(
            x + .5 - WIDTH_INNER/2,
            y + HEIGHT - HEIGHT_INNER,
            z + .5 - WIDTH_INNER/2,
            x + .5 + WIDTH_INNER/2,
            y + HEIGHT,
            z + .5 + WIDTH_INNER/2,
        );

        // Push vertices down
        pushAABB(
            vertices,
            aabb_down,
            pivot,
            matrix,
            {
                down:   new AABBSideParams(c_inner_down, 0, 1),
                south:  new AABBSideParams(c_side, 0, 1),
                north:  new AABBSideParams(c_side, 0, 1),
                west:   new AABBSideParams(c_side, 0, 1),
                east:   new AABBSideParams(c_side, 0, 1),
            },
            true,
            new Vector(x, y, z)
        );

        // mat4.scale(matrix, matrix, [0.5, 0.5, 0.5]);
        let index = Math.abs(Math.round(x * CHUNK_SIZE_Z + z)) % 256;
        const flower_block_id = RANDOM_FLOWERS[Math.floor(randoms[index] * RANDOM_FLOWERS.length)];

        // Return text block
        //if(block.extra_data) {
            //let text = block.extra_data?.text;
            //if(text) {
                const fb = new FakeBlock(
                    flower_block_id,
                    null,
                    new Vector(x, y + 3/16, z),
                    new Vector(0, 1, 0),
                    pivot,
                    matrix,
                    ['no_random_pos']
                );
                return [fb];
            //}
        //}

        return null;

    }

}
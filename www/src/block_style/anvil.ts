import { DIRECTION, IndexedColor } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import type { BlockManager, FakeTBlock } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';
import { BlockStyleRegInfo } from './default.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';

// Наковальня
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['anvil'],
            this.func,
            this.computeAABB
        );
    }

    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : any = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const aabb = new AABB();
        const cd = tblock.getCardinalDirection();
        if (cd == DIRECTION.WEST || cd == DIRECTION.EAST) {
           aabb.set(0.12, 0, 0, 0.88, 1, 1);
        } else {
            aabb.set(0, 0, 0.12, 1, 1, 0.88);
        }
        return [aabb];
    }

    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {
        if(typeof block == 'undefined') {
            return;
        }

        const texture = block.material.texture;
        const side = style.block_manager.calcTexture(texture, DIRECTION.WEST);
        let up = side;
        const damage = block.extra_data?.damage;
        if (damage == 1) {
            up = style.block_manager.calcTexture(texture, DIRECTION.NORTH);
        } else if (damage == 2) {
            up = style.block_manager.calcTexture(texture, DIRECTION.SOUTH);
        }
        const cd = block.getCardinalDirection();
        box(16, 10, 6, 10, cd, vertices, side, up, x, y, z);
        box(8, 3, 5, 5, cd, vertices, side, side, x, y, z);
        box(10, 8, 1, 4, cd, vertices, side, side, x, y, z);
        box(12, 12, 4, 0, cd, vertices, side, side, x, y, z);
    }

}

function box(width, length, height, shift, dir, vertices, texture, texture_up, x, y, z) {
    width /= 16;
    shift /= 16;
    height /= 16;
    length /= 16;
    const lm = IndexedColor.WHITE;
    const flags = 0;
    if (dir == DIRECTION.WEST || dir == DIRECTION.EAST) {
        vertices.push( x + 0.5, z + 0.5 - width / 2, y + shift + height / 2, length, 0, 0, 0, 0, height, texture[0], texture[1], texture[2] * length, texture[3] * height, lm.pack(), flags);
        vertices.push( x + 0.5, z + 0.5 + width / 2, y + shift + height / 2, length, 0, 0, 0, 0, -height, texture[0], texture[1], texture[2] * length, texture[3] * height, lm.pack(), flags);
        vertices.push( x + 0.5 - length / 2, z + 0.5, y + shift + height / 2, 0, width, 0, 0, 0, -height, texture[0], texture[1], texture[2] * width, texture[3] * height, lm.pack(), flags);
        vertices.push( x + 0.5 + length / 2, z + 0.5, y + shift + height / 2, 0, width, 0, 0, 0, height, texture[0], texture[1], texture[2] * width, texture[3] * height, lm.pack(), flags);
        vertices.push( x + 0.5, z + 0.5, y + shift, length, 0, 0, 0, -width, 0, texture[0], texture[1], texture[2] * length, texture[3] * width, lm.pack(), flags);
        vertices.push( x + 0.5, z + 0.5, y + shift + height, length, 0, 0, 0, width, 0, texture_up[0], texture_up[1], texture_up[2] * length, texture_up[3] * width, lm.pack(), flags);
    } else {
        vertices.push( x + 0.5, z + 0.5 - length / 2, y + shift + height / 2, width, 0, 0, 0, 0, height, texture[0], texture[1], texture[2] * width, texture[3] * height, lm.pack(), flags);
        vertices.push( x + 0.5, z + 0.5 + length / 2, y + shift + height / 2, width, 0, 0, 0, 0, -height, texture[0], texture[1], texture[2] * width, texture[3] * height, lm.pack(), flags);
        vertices.push( x + 0.5 - width / 2, z + 0.5, y + shift + height / 2, 0, length, 0, 0, 0, -height, texture[0], texture[1], texture[2] * length, texture[3] * height, lm.pack(), flags);
        vertices.push( x + 0.5 + width / 2, z + 0.5, y + shift + height / 2, 0, length, 0, 0, 0, height, texture[0], texture[1], texture[2] * length, texture[3] * height, lm.pack(), flags);
        vertices.push( x + 0.5, z + 0.5, y + shift, width, 0, 0, 0, -length, 0, texture[0], texture[1], texture[2] * length, texture[3] * length, lm.pack(), flags);
        vertices.push( x + 0.5, z + 0.5, y + shift + height, 0, length, 0, -width, 0, 0, texture_up[0], texture_up[1], texture_up[2] * length, texture_up[3] * width, lm.pack(), flags);
    }
}
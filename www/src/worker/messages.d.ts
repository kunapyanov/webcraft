// This file is .d.ts because we can't use imports in chunk_worker.ts
// see the TS bug https://github.com/microsoft/TypeScript/issues/44040

type TChunkWorkerMessageInit = {
    generator   : TGeneratorInfo
    world_seed  : string
    world_guid  : string
    settings    : TBlocksSettings
    resource_cache?: Map<any, any>
    is_server   : boolean
}

type TScannedTickers = {
    randomTickersCount: int
    tickerFlatIndices: int[]
}

type TChunkWorkerMessageBlocksGenerated = {
    addr        : IVector
    uniqId      : int
    tblocks
    packedCells : Int16Array
    genQueueSize?: int

    // randomTickersCount: int
    // tickerFlatIndices: int[]

    tickers     : TScannedTickers | null
}
﻿/// <reference path="../creeps/repairer/repairerDefinition.ts" />
/// <reference path="../creeps/repairer/repairer.ts" />
/// <reference path="./manager.ts" />

class RepairManager implements RepairManagerInterface {

    public get memory(): RepairManagerMemory {
        return this.accessMemory();
    }

    accessMemory() {
        if (this.mainRoom.memory.repairManager == null)
            this.mainRoom.memory.repairManager = {
                emergencyTargets: {},
                repairTargets: {}
            }
        return this.mainRoom.memory.repairManager;
    }

    _creeps: { time: number, creeps: Array<Creep> } = { time: 0, creeps: null };
    public get creeps(): Array<Creep> {
        if (this._creeps.time < Game.time)
            this._creeps = {
                time: Game.time, creeps: this.mainRoom.creepsByRole('repairer')
            };
        return this._creeps.creeps;
    }

    _idleCreeps: { time: number, creeps: Array<Creep> } = { time: 0, creeps: null };
    public get idleCreeps(): Array<Creep> {
        if (this._idleCreeps.time < Game.time)
            this._idleCreeps = {
                time: Game.time, creeps: _.filter(this.creeps, (c) => (<RepairerMemory>c.memory).targetId == null)
            };
        return this._creeps.creeps;
    }
    public set idleCreeps(value: Array<Creep>) {
        if (value == null)
            this._idleCreeps.creeps = [];
        else
            this._idleCreeps.creeps = value;
    }

    public static forceStopRepairDelegate(s: { structureType?: string, sT?: string, hits: number, hitsMax: number }): boolean {
        return s.hits >= s.hitsMax;// || s.hits > 2000000;
        //return (s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART) && s.hits > 600000 || (s.hits >= s.hitsMax);
    }

    public static targetDelegate(s: { structureType?: string, sT?: string, hits: number, hitsMax: number }): boolean {
        return (s.structureType != STRUCTURE_RAMPART && s.sT != STRUCTURE_RAMPART && s.structureType != STRUCTURE_WALL && s.sT != STRUCTURE_WALL && s.hits < s.hitsMax || (s.structureType == STRUCTURE_RAMPART || s.sT == STRUCTURE_RAMPART || s.structureType == STRUCTURE_WALL || s.sT == STRUCTURE_WALL) && s.hits < 100000) && s.hits < s.hitsMax
    }

    public static emergencyTargetDelegate(s: { structureType?: string, sT?: string, hits: number, hitsMax: number }): boolean {
        return (s.hits < s.hitsMax * 0.2 && (s.structureType == STRUCTURE_CONTAINER || s.sT == STRUCTURE_CONTAINER) || s.hits < 1000 && (s.structureType == STRUCTURE_ROAD || s.structureType == STRUCTURE_RAMPART || s.sT == STRUCTURE_ROAD || s.sT == STRUCTURE_RAMPART) && s.hits < 5000) && s.hits < s.hitsMax;
    }

    public static emergencyStopDelegate(s: { structureType?: string, sT?: string, hits: number, hitsMax: number }): boolean {
        return ((s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART || s.sT == STRUCTURE_WALL || s.sT == STRUCTURE_RAMPART) && s.hits > 20000 || s.hits >= s.hitsMax && (s.structureType == STRUCTURE_ROAD || s.sT == STRUCTURE_ROAD) || s.hits > 0.5 * s.hitsMax && (s.structureType == STRUCTURE_CONTAINER || s.sT == STRUCTURE_CONTAINER)) || s.hits >= s.hitsMax;
    }


    

   

    constructor(public mainRoom: MainRoom) {
        if (myMemory['profilerActive']) {
            this.preTick = profiler.registerFN(this.preTick, 'RepairManager.preTick');
            this.tick = profiler.registerFN(this.tick, 'RepairManager.tick');
        }

    }

    public preTick(myRoom: MyRoomInterface) {
        if (this.mainRoom.spawnManager.isBusy || !this.mainRoom.mainContainer)
            return;

        if (myRoom.name == myRoom.mainRoom.name && myRoom.room.controller.level>=3 || myRoom.room && _.size(myRoom.repairStructures) > 0) {

            let maxMainRoomCreeps = 1 + Math.max(0, this.mainRoom.room.controller.level - 8);

            let roomCreeps = _.filter(this.creeps, x => x.memory.roomName == myRoom.name);
            if (roomCreeps.length < (myRoom.name == this.mainRoom.name ? maxMainRoomCreeps : 1)) {
                    let definition = RepairerDefinition.getDefinition(this.mainRoom.maxSpawnEnergy).getBody();

                    this.mainRoom.spawnManager.addToQueue(definition, { role: 'repairer', roomName: myRoom.name, state: RepairerState.Refilling }, 1);
                }

        }
    }

    public tick() {
        this.creeps.forEach((c) => new Repairer(c.name, this.mainRoom).tick());
    }
}
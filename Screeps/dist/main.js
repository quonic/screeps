"use strict";
var Config;
(function (Config) {
    // APPLICATION CORE CONFIGURATION
    /**
     * Enable this if you want a lot of text to be logged to console.
     * @type {boolean}
     */
    Config.VERBOSE = true;
    // APPLICATION GAMEPLAY CONFIGURATION
    /**
     * @type {number}
     */
    Config.MAX_HARVESTERS_PER_SOURCE = 4;
    /**
     * Default amount of minimal ticksToLive Screep can have, before it goes to renew. This is only default value, that don't have to be used.
     * So it doesn't cover all Screeps
     * @type {number}
     */
    Config.DEFAULT_MIN_LIFE_BEFORE_NEEDS_REFILL = 700;
})(Config = exports.Config || (exports.Config = {}));
//import {ObjectWithMemory} from "../../objectWithMemory";
var MySource = (function () {
    function MySource(id, myRoom) {
        this.myRoom = myRoom;
        this.id = id;
        this.memory.id = id;
        if (this.memory.lastScanTime == null)
            this.scan();
        if (this.memory.pos)
            this.pos = new RoomPosition(this.memory.pos.x, this.memory.pos.y, this.memory.pos.roomName);
    }
    Object.defineProperty(MySource.prototype, "memory", {
        get: function () {
            return this.accessMemory();
        },
        enumerable: true,
        configurable: true
    });
    MySource.prototype.accessMemory = function () {
        if (this.myRoom.memory.sources == null)
            this.myRoom.memory.sources = {};
        if (this.myRoom.memory.sources[this.id] == null)
            this.myRoom.memory.sources[this.id] = {
                id: this.id,
                containerId: null,
                energyCapacity: null,
                harvestingSpots: null,
                keeper: null,
                lastScanTime: null,
                pos: null,
                mainContainerRoadBuiltTo: null,
                mainContainerPathLength: null
            };
        return this.myRoom.memory.sources[this.id];
    };
    MySource.prototype.getHarvestingSpots = function (source) {
        var surroundingTerrain = source.room.lookForAtArea('terrain', source.pos.y - 1, source.pos.x - 1, source.pos.y + 1, source.pos.x + 1);
        var walls = 0;
        for (var y = source.pos.y - 1; y <= source.pos.y + 1; y++)
            for (var x = source.pos.x - 1; x <= source.pos.x + 1; x++) {
                var row = surroundingTerrain[y][x];
                if (_.some(row, function (r) { return r == 'wall'; }))
                    walls++;
            }
        return 9 - walls;
    };
    MySource.prototype.findContainer = function () {
        var candidates = this.pos.findInRange(FIND_STRUCTURES, 4, {
            filter: function (s) { return s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_STORAGE; }
        });
        if (candidates.length > 0)
            return candidates[0];
        else
            return null;
    };
    MySource.prototype.calculatePathLengthToMainContainer = function () {
        var mainContainer = null;
        this.myRoom && this.myRoom.mainRoom && (mainContainer = this.myRoom.mainRoom.mainContainer);
        var sourceContainer = null;
        this.memory.containerId && (sourceContainer = Game.getObjectById(this.memory.containerId));
        if (mainContainer == null || Source == null)
            return null;
        var path = PathFinder.search(mainContainer.pos, { pos: sourceContainer.pos, range: 2 });
        this.memory.mainContainerPathLength = path.path.length;
        return this.memory.mainContainerPathLength;
    };
    MySource.prototype.scan = function () {
        var source = Game.getObjectById(this.id);
        if (source != null) {
            this.memory.lastScanTime = Game.time;
            this.memory.energyCapacity = source.energyCapacity;
            this.memory.pos = source.pos;
            this.pos = new RoomPosition(this.memory.pos.x, this.memory.pos.y, this.memory.pos.roomName);
            this.memory.lastScanTime = Game.time;
            this.memory.keeper = source.pos.findInRange(FIND_STRUCTURES, 5, { filter: function (s) { return s.structureType == STRUCTURE_KEEPER_LAIR; } }).length > 0;
            this.memory.harvestingSpots = this.getHarvestingSpots(source);
            if (this.memory.mainContainerPathLength != null)
                this.calculatePathLengthToMainContainer();
            if (!Game.getObjectById(this.memory.containerId)) {
                var container = this.findContainer();
                if (container) {
                    this.memory.containerId = container.id;
                }
                else {
                    this.memory.containerId = null;
                }
            }
            return true;
        }
        return false;
    };
    MySource.prototype.containerMissing = function () {
        if (Game.rooms[this.pos.roomName] == null)
            return false;
        if (Game.getObjectById(this.memory.containerId) != null)
            return false;
        var container = this.findContainer();
        if (container != null) {
            this.memory.containerId = container.id;
            return false;
        }
        this.memory.containerId = null;
        return this.pos.findInRange(FIND_CONSTRUCTION_SITES, 4, {
            filter: function (s) { return s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_STORAGE; }
        }).length == 0;
    };
    return MySource;
}());
exports.MySource = MySource;
//import {ObjectWithMemory} from "../../objectWithMemory";
var MyContainer = (function () {
    function MyContainer(id, myRoom) {
        this.id = id;
        this.memory.id = id;
        if (this.memory.lastScanTime == null)
            this.scan();
        if (this.memory.pos != null)
            this.pos = new RoomPosition(this.memory.pos.x, this.memory.pos.y, this.memory.pos.roomName);
    }
    Object.defineProperty(MyContainer.prototype, "memory", {
        get: function () {
            return this.accessMemory();
        },
        enumerable: true,
        configurable: true
    });
    MyContainer.prototype.accessMemory = function () {
        if (this.myRoom.memory.containers == null)
            this.myRoom.memory.containers = {};
        if (this.myRoom.memory.containers[this.id] == null)
            this.myRoom.memory.containers[this.id] = {
                id: this.id,
                pos: null,
                lastScanTime: null
            };
        return this.myRoom.memory.containers[this.id];
    };
    MyContainer.prototype.scan = function (container) {
        var cont = container;
        if (!cont)
            cont = Game.getObjectById(this.id);
        if (cont) {
            this.pos = cont.pos;
            this.memory.pos = this.pos;
            this.memory.lastScanTime = Game.time;
            return true;
        }
        return false;
    };
    return MyContainer;
}());
exports.MyContainer = MyContainer;
var MainRoom = (function () {
    function MainRoom(roomName) {
        this.name = roomName;
        this.myRoom = Colony.getRoom(roomName);
        this.myRoom.mainRoom = this;
        this.myRoom.memory.mainRoomName = this.name;
        if (this.myRoom.memory.mainRoomDistanceDescriptions == null)
            this.myRoom.memory.mainRoomDistanceDescriptions = {};
        this.myRoom.memory.mainRoomDistanceDescriptions[this.name] = { roomName: this.name, distance: 0 };
        this.room = Game.rooms[roomName];
        this.spawnNames = _.map(_.filter(Game.spawns, function (s) { return s.room.name == roomName; }), function (s) { return s.name; });
        if (this.memory.mainPosition) {
            var pos = this.memory.mainPosition;
            this.mainPosition = new RoomPosition(pos.x, pos.y, roomName);
        }
        else {
            this.memory.mainPosition = this.mainPosition = Game.spawns[this.spawnNames[0]].pos;
        }
        this.update(true);
        //if (!this.memory.spawnManager) this.memory.spawnManager = {  }
        //if (!this.memory.constructionManager) this.memory.constructionManager = {}
        //if (!this.memory.repairManager) this.memory.repairManager = { emergencyTargets: {}, repairTargets: {} }
        //if (!this.memory.upgradeManager) this.memory.upgradeManager = {}
        //if (!this.memory.spawnFillManager) this.memory.spawnFillManager = {}
        //if (!this.memory.harvestingManager) this.memory.harvestingManager = {}
        //if (!this.memory.defenseManager) this.memory.defenseManager = {}
        //if (!this.memory.reservationManager) this.memory.reservationManager = {}
        this.spawnManager = new SpawnManager(this, this.memory.spawnManager);
        this.creepManagers = {
            constructionManager: new ConstructionManager(this),
            repairManager: new RepairManager(this),
            upgradeManager: new UpgradeManager(this),
            spawnFillManager: new SpawnFillManager(this),
            harvestingManager: new HarvestingManager(this),
            defenseManager: new DefenseManager(this),
            reservationManager: new ReservationManager(this)
        };
        if (!this.memory.roadConstructionManager)
            this.memory.roadConstructionManager = null;
        this.roadConstructionManager = new RoadConstructionManager(this);
    }
    Object.defineProperty(MainRoom.prototype, "memory", {
        get: function () {
            return this.accessMemory();
        },
        enumerable: true,
        configurable: true
    });
    MainRoom.prototype.accessMemory = function () {
        if (Colony.memory.mainRooms == null)
            Colony.memory.mainRooms = {};
        if (Colony.memory.mainRooms[this.name] == null)
            Colony.memory.mainRooms[this.name] = {
                name: this.name,
                mainPosition: null,
                spawnManager: null,
                constructionManager: null,
                repairManager: null,
                upgradeManager: null,
                spawnFillManager: null,
                harvestingManager: null,
                defenseManager: null,
                reservationManager: null,
                roadConstructionManager: null
            };
        return Colony.memory.mainRooms[this.name];
    };
    MainRoom.prototype.getMaxSpawnEnergy = function () {
        var maxSpawnEnergy = 0;
        this.extensionCount = this.room.find(FIND_MY_STRUCTURES, { filter: function (s) { return s.structureType == STRUCTURE_EXTENSION; } }).length;
        if (this.extensionCount > CONTROLLER_STRUCTURES.extension[this.room.controller.level])
            this.extensionCount = CONTROLLER_STRUCTURES.extension[this.room.controller.level];
        if (this.room.controller.level == 8)
            maxSpawnEnergy = this.extensionCount * 200;
        else if (this.room.controller.level == 7)
            maxSpawnEnergy = this.extensionCount * 100;
        else
            maxSpawnEnergy = this.extensionCount * 50;
        maxSpawnEnergy += 300;
        if (this.creeps.length == 0 || !this.mainContainer || this.mainContainer.store.energy == 0)
            maxSpawnEnergy = Math.max(this.room.energyAvailable, 300);
        return maxSpawnEnergy;
    };
    MainRoom.prototype.getAllSources = function () {
        var sources = this.myRoom.sources;
        for (var roomIdx in _.filter(this.connectedRooms, function (x) { return x.canHarvest; }))
            for (var sourceIdx in this.connectedRooms[roomIdx].sources)
                sources[this.connectedRooms[roomIdx].sources[sourceIdx].id] = this.connectedRooms[roomIdx].sources[sourceIdx];
        return sources;
    };
    MainRoom.prototype.update = function (runAll) {
        var _this = this;
        if (runAll === void 0) { runAll = true; }
        this.creeps = _.filter(Game.creeps, function (c) { return c.memory.mainRoomName == _this.name && !c.memory.handledByColony; });
        if (runAll || (Game.time % 100) == 0) {
            this.maxSpawnEnergy = this.getMaxSpawnEnergy();
            this.connectedRooms = _.filter(Colony.rooms, function (r) { return r.name != _this.room.name && r.mainRoom == _this; });
            this.allRooms = this.connectedRooms.concat(this.myRoom);
        }
        this.sources = this.getAllSources();
        //this.sources = _this.myRoom.sources.concat(_.flatten(_.map(this.connectedRooms, (r) => _.values<MySource>(r.sources))));
        //this.sources = _.values<MySource>(this.myRoom.sources).concat(_.flatten(_.map(this.connectedRooms, (r) => _.values<MySource>(r.sources))));
    };
    MainRoom.prototype.placeExtensions = function () {
        if (Game.time % 100 != 0)
            return;
        var maxExtensions = CONTROLLER_STRUCTURES.extension[this.room.controller.level];
        for (var i = maxExtensions - 1; i >= 0; i--) {
            var idiv5 = ~~(i / 5);
            var x = Math.ceil(idiv5 / 2);
            if (idiv5 % 2 == 1)
                x = -x;
            x += this.mainPosition.x;
            var y = this.mainPosition.y + 3 + (i % 5) * 2; //-(~~(i/5)%2)
            if ((idiv5 + 3) % 4 > 1)
                y--;
            var targetPos = new RoomPosition(x, y, this.name);
            if (targetPos.createConstructionSite(STRUCTURE_EXTENSION) == ERR_RCL_NOT_ENOUGH)
                break;
        }
    };
    MainRoom.prototype.placeMainContainer = function () {
        if (Memory['verbose'])
            console.log('SpawnRoomHandler.placeMainContainer');
        var closestSource = this.mainPosition.findClosestByPath(FIND_SOURCES);
        var targetPos = null;
        if (!closestSource)
            targetPos = new RoomPosition(this.mainPosition.x + 4, this.mainPosition.y + 4, this.name);
        else {
            targetPos = new RoomPosition(this.mainPosition.x, this.mainPosition.y, this.name);
            var direction = this.mainPosition.getDirectionTo(closestSource);
            switch (direction) {
                case TOP:
                    targetPos.y -= 4;
                    break;
                case TOP_RIGHT:
                    targetPos.y -= 4;
                    targetPos.x += 4;
                    break;
                case RIGHT:
                    targetPos.x += 4;
                    break;
                case BOTTOM_RIGHT:
                    targetPos.y += 4;
                    targetPos.x += 4;
                    break;
                case BOTTOM:
                    targetPos.y += 4;
                    break;
                case BOTTOM_LEFT:
                    targetPos.y += 4;
                    targetPos.x -= 4;
                    break;
                case LEFT:
                    targetPos.x -= 4;
                    break;
                case TOP_LEFT:
                    targetPos.y += 4;
                    break;
            }
        }
        targetPos.createConstructionSite(STRUCTURE_CONTAINER);
    };
    MainRoom.prototype.placeStorage = function () {
        if (Memory['verbose'])
            console.log('SpawnRoomHandler.placeStorage');
        var closestSource = this.mainPosition.findClosestByPath(FIND_SOURCES);
        var targetPos = null;
        if (!closestSource)
            targetPos = new RoomPosition(this.mainPosition.x + 2, this.mainPosition.y + 2, this.name);
        else {
            targetPos = new RoomPosition(this.mainPosition.x, this.mainPosition.y, this.name);
            var direction = this.mainPosition.getDirectionTo(closestSource);
            switch (direction) {
                case TOP:
                    targetPos.y -= 2;
                    break;
                case TOP_RIGHT:
                    targetPos.y -= 2;
                    targetPos.x += 2;
                    break;
                case RIGHT:
                    targetPos.x += 2;
                    break;
                case BOTTOM_RIGHT:
                    targetPos.y += 2;
                    targetPos.x += 2;
                    break;
                case BOTTOM:
                    targetPos.y += 2;
                    break;
                case BOTTOM_LEFT:
                    targetPos.y += 2;
                    targetPos.x -= 2;
                    break;
                case LEFT:
                    targetPos.x -= 2;
                    break;
                case TOP_LEFT:
                    targetPos.y += 2;
                    break;
            }
        }
        targetPos.createConstructionSite(STRUCTURE_STORAGE);
    };
    MainRoom.prototype.checkAndPlaceMainContainer = function () {
        if (this.mainContainer == null) {
            var candidates = this.mainPosition.findInRange(FIND_STRUCTURES, 4, {
                filter: function (s) { return s.structureType == STRUCTURE_CONTAINER; }
            });
            if (candidates.length > 0) {
                this.mainContainer = candidates[0];
            }
            else {
                var constructionCandidates = this.mainPosition.findInRange(FIND_CONSTRUCTION_SITES, 4, {
                    filter: function (s) { return s.structureType == STRUCTURE_CONTAINER; }
                });
                if (constructionCandidates.length == 0) {
                    this.placeMainContainer();
                }
            }
        }
    };
    MainRoom.prototype.checkAndPlaceStorage = function () {
        var storage = this.room.storage;
        if (storage != null) {
            this.mainContainer = storage;
        }
        else if (CONTROLLER_STRUCTURES.storage[this.room.controller.level] > 0) {
            this.placeStorage();
        }
        else {
            this.checkAndPlaceMainContainer();
        }
    };
    MainRoom.prototype.checkCreeps = function () {
        var startCpu;
        var endCpu;
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.spawnFillManager.checkCreeps();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('SpawnFillManager.checkCreeps: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.defenseManager.checkCreeps();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('DefenseManager.checkCreeps: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.harvestingManager.checkCreeps();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('HarvestingManager.checkCreeps: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.reservationManager.checkCreeps();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('ReservationManager.checkCreeps: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.repairManager.checkCreeps();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('RepairManager.checkCreeps: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.constructionManager.checkCreeps();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('ConstructionManager.checkCreeps: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.upgradeManager.checkCreeps();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('UpgradeManager.checkCreeps: ' + (endCpu - startCpu).toFixed(2));
        }
    };
    MainRoom.prototype.tickCreeps = function () {
        var startCpu;
        var endCpu;
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.spawnFillManager.tick();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('SpawnFillManager.tick: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.harvestingManager.tick();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('HarvestingManager.tick: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.repairManager.tick();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('RepairManager.tick: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.constructionManager.tick();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('ConstructionManager.tick: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.upgradeManager.tick();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('UpgradeManager.tick: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.defenseManager.tick();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('DefenseManager.tick: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.creepManagers.reservationManager.tick();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('ReservationManager.tick: ' + (endCpu - startCpu).toFixed(2));
        }
    };
    MainRoom.prototype.tick = function () {
        //console.log('Memory Test= ' + JSON.stringify(Memory['colony']['rooms']['E21S22']['test']));
        var _this = this;
        var startCpu;
        var endCpu;
        if (Memory['verbose'])
            console.log('SpawnRoomHandler.tick');
        if (this.room == null)
            return;
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.update();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('MainRoom.update: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.checkAndPlaceStorage();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('MainRoom.checAndPlaceStorage: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.placeExtensions();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('MainRoom.placeExtensions: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        if (this.mainContainer)
            this.creepManagers.harvestingManager.placeSourceContainers();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('HarvestingManager.placeSourceContainers: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        if (this.mainContainer)
            this.roadConstructionManager.tick();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('RoadConstructionManager.tick: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.allRooms.forEach(function (r) { return r.scanForHostiles(); });
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('MainRoom.scanForHostiles: ' + (endCpu - startCpu).toFixed(2));
        }
        if (this.creeps.length > 0)
            this.checkCreeps();
        else
            this.creepManagers.harvestingManager.checkCreeps();
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.spawnManager.spawn();
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('MainRoom.spawnManager.spawn: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        this.room.find(FIND_MY_STRUCTURES, { filter: function (x) { return x.structureType == STRUCTURE_TOWER; } }).forEach(function (x) { return new MyTower(x, _this).tick(); });
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('Tower.tick: ' + (endCpu - startCpu).toFixed(2));
        }
        this.tickCreeps();
        if (Game.time % 100 == 0)
            for (var idx in this.allRooms) {
                var myRoom = this.allRooms[idx];
                myRoom.scan();
            }
    };
    return MainRoom;
}());
exports.MainRoom = MainRoom;
var Colony;
(function (Colony) {
    Colony.mainRooms = {};
    Colony.rooms = {};
    function getRoom(roomName) {
        var room = Colony.rooms[roomName];
        if (room) {
            return room;
        }
        if (!Colony.memory.rooms[roomName] && !Game.rooms[roomName]) {
            return null;
        }
        else {
            if (!Colony.memory.rooms[roomName]) {
                Colony.memory.rooms[roomName] = { containers: null, lastScanTime: null, mainRoomName: null, name: roomName, sources: null, foreignOwner: false, foreignReserver: false, hostiles: false, mainRoomDistanceDescriptions: {} };
            }
            Colony.rooms[roomName] = new MyRoom(roomName);
            return Colony.rooms[roomName];
        }
    }
    Colony.getRoom = getRoom;
    function initialize(memory) {
        Colony.memory = Memory['colony'];
        Colony.myName = _.map(Game.spawns, function (s) { return s; })[0].owner.username;
        if (memory.rooms == null)
            memory.rooms = {};
        if (memory.mainRooms == null)
            memory.mainRooms = {};
        for (var spawnName in Game.spawns) {
            var spawn = Game.spawns[spawnName];
            break;
        }
        if (spawn != null) {
            var creeps = _.filter(Game.creeps, function (c) { return c.memory.mainRoomName == null && !c.memory.handledByColony; });
            for (var idx in creeps)
                creeps[idx].memory.mainRoomName = spawn.room.name;
        }
        if (!memory.mainRooms)
            memory.mainRooms = {};
        var mainRoomNames = _.uniq(_.map(Game.spawns, function (s) { return s.room.name; }));
        for (var idx in mainRoomNames) {
            Colony.mainRooms[mainRoomNames[idx]] = new MainRoom(mainRoomNames[idx]);
        }
    }
    Colony.initialize = initialize;
    function assignMainRoom(room) {
        // TODO Rewrite it for multiple MainRooms
        for (var idx in Colony.mainRooms)
            return Colony.mainRooms[idx];
    }
    Colony.assignMainRoom = assignMainRoom;
    function shouldSendScout(roomName) {
        var myRoom = getRoom(roomName);
        var result = !Game.map.isRoomProtected(roomName)
            && (myRoom == null || !myRoom.memory.hostiles && !myRoom.memory.foreignOwner && !myRoom.memory.foreignReserver || (Game.time % 2000) == 0);
        return result;
    }
    function createScouts() {
        for (var roomName in Colony.mainRooms) {
            if (!Game.map.isRoomProtected(roomName)) {
                var mainRoom = Colony.mainRooms[roomName];
                var exits = mainRoom.myRoom.exits;
                var _loop_1 = function(exitDirection) {
                    var targetRoomName = exits[exitDirection];
                    if (shouldSendScout(targetRoomName) && _.filter(Game.creeps, function (c) { return c.memory.role == 'scout' && c.memory.handledByColony == true && c.memory.targetRoomName == targetRoomName; }).length == 0) {
                        mainRoom.spawnManager.AddToQueue(['move'], { handledByColony: true, role: 'scout', mainRoomName: null, targetRoomName: targetRoomName });
                    }
                };
                for (var exitDirection in exits) {
                    _loop_1(exitDirection);
                }
            }
        }
    }
    Colony.createScouts = createScouts;
    function tick() {
        Colony.memory = Memory['colony'];
        var startCpu;
        var endCpu;
        if (Memory['verbose'])
            console.log('ColonyHandler.tick');
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        if (Game.time % 10 == 0) {
            var roomArray = [];
            for (var x in Colony.rooms)
                roomArray.push(Colony.rooms[x]);
            var idx = ~~((Game.time % (roomArray.length * 10)) / 10);
            var room = roomArray[idx];
            for (var mainIdx in Colony.mainRooms) {
                var mainRoom = Colony.mainRooms[mainIdx];
                var routeResult = Game.map.findRoute(room.name, mainRoom.name);
                if (routeResult === ERR_NO_PATH)
                    var distance = 9999;
                else
                    var distance = routeResult.length;
                room.memory.mainRoomDistanceDescriptions[mainRoom.name] = { roomName: mainRoom.name, distance: distance };
            }
        }
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('Colony.Calculate destinations to MainRooms: ' + (endCpu - startCpu).toFixed(2));
        }
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        for (var roomName in Game.rooms) {
            getRoom(roomName);
        }
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('Colony: Query all rooms ' + (endCpu - startCpu).toFixed(2));
        }
        createScouts();
        for (var roomName in Colony.mainRooms)
            Colony.mainRooms[roomName].tick();
        var creeps = _.filter(Game.creeps, function (c) { return c.memory.handledByColony; });
        if (Memory['trace'])
            startCpu = Game.cpu.getUsed();
        for (var idx in creeps) {
            var creep = creeps[idx];
            if (creep.memory.role == 'scout')
                new Scout(creep).tick();
        }
        if (Memory['trace']) {
            endCpu = Game.cpu.getUsed();
            console.log('Colony: Handle scouts ' + (endCpu - startCpu).toFixed(2));
        }
    }
    Colony.tick = tick;
})(Colony = exports.Colony || (exports.Colony = {}));
//import {ObjectWithMemory} from "../../objectWithMemory";
var MyRoom = (function () {
    //memory: MyRoomMemory;
    function MyRoom(name) {
        var _this = this;
        this.name = name;
        this.memory.name = name;
        if (this.memory.containers == null)
            this.memory.containers = {};
        if (this.memory.sources == null)
            this.memory.sources = {};
        this.sources = _.indexBy(_.map(this.memory.sources, function (s) { return new MySource(s.id, _this); }), function (s) { return s.id; });
        this.containers = _.indexBy(_.map(this.memory.containers, function (s) { return new MyContainer(s.id, _this); }), function (s) { return s.id; });
        this.mainRoom = Colony.mainRooms[this.memory.mainRoomName];
        //if (this.memory.mainRoomDistanceDescriptions == null)
        //    this.memory.mainRoomDistanceDescriptions = {};
        if (!this.mainRoom) {
            this.mainRoom = Colony.assignMainRoom(this);
            if (this.mainRoom)
                this.memory.mainRoomName = this.mainRoom.name;
        }
        if (Game.rooms[this.name] != null)
            this.scan();
    }
    Object.defineProperty(MyRoom.prototype, "memory", {
        get: function () {
            return this.accessMemory();
        },
        enumerable: true,
        configurable: true
    });
    MyRoom.prototype.accessMemory = function () {
        if (Colony.memory.rooms == null)
            Colony.memory.rooms = {};
        if (Colony.memory.rooms[this.name] == null)
            Colony.memory.rooms[this.name] = {
                name: this.name,
                containers: {},
                sources: {},
                hostiles: false,
                foreignOwner: null,
                foreignReserver: null,
                lastScanTime: null,
                mainRoomDistanceDescriptions: {},
                mainRoomName: null
            };
        return Colony.memory.rooms[this.name];
    };
    MyRoom.prototype.scanSources = function (room) {
        if (Object.keys(this.sources).length == 0) {
            this.sources = {};
            var sources = room.find(FIND_SOURCES);
            for (var idx in sources) {
                var source = sources[idx];
                this.sources[source.id] = new MySource(source.id, this);
            }
        }
        else {
            for (var sourceId in this.sources)
                this.sources[sourceId].scan();
        }
    };
    MyRoom.prototype.scanContainers = function (room) {
        if (this.containers != null) {
            for (var idx in this.containers) {
                var container = Game.getObjectById(this.containers[idx].id);
                if (!container) {
                    delete this.containers[this.containers[idx].id];
                }
                else {
                    this.containers[this.containers[idx].id].scan(container);
                }
            }
        }
        var containers = room.find(FIND_STRUCTURES, { filter: function (s) { return s.structureType == STRUCTURE_CONTAINER; } });
        for (var idx in containers) {
            var container = containers[idx];
            if (!container) {
                if (this.memory.containers[container.id] == null)
                    this.memory.containers[container.id] = { id: container.id, pos: container.pos, lastScanTime: Game.time };
                this.containers[container.id] = new MyContainer(container.id, this);
            }
        }
    };
    MyRoom.prototype.scan = function () {
        var room = Game.rooms[this.name];
        if (this.exits == null) {
            this.exits = {};
            var exits = Game.map.describeExits(this.name);
            if (exits != null)
                for (var exitDirection in exits)
                    this.exits[exitDirection] = exits[exitDirection];
        }
        if (room == null)
            return;
        this.memory.foreignOwner = room.controller.owner != null && room.controller.owner.username != Colony.myName;
        this.memory.foreignReserver = room.controller.reservation != null && room.controller.reservation.username != Colony.myName;
        this.memory.lastScanTime = Game.time;
        this.scanSources(room);
        this.scanContainers(room);
    };
    MyRoom.prototype.scanForHostiles = function () {
        var room = Game.rooms[this.name];
        if (room == null)
            return;
        this.memory.hostiles = room.find(FIND_HOSTILE_CREEPS, { filter: function (c) { return c.owner.username != 'Source Keeper'; } }).length > 0;
    };
    MyRoom.prototype.canHarvest = function () {
        return (this.name == this.mainRoom.name
            || (!this.memory.foreignOwner && !this.memory.foreignReserver && this.memory.mainRoomDistanceDescriptions[this.mainRoom.name] != null && this.memory.mainRoomDistanceDescriptions[this.mainRoom.name].distance <= 1));
    };
    return MyRoom;
}());
exports.MyRoom = MyRoom;
var SpawnManager = (function () {
    function SpawnManager(mainRoom, memory) {
        this.queue = [];
        this.mainRoom = mainRoom;
    }
    Object.defineProperty(SpawnManager.prototype, "memory", {
        get: function () {
            return this.accessMemory();
        },
        enumerable: true,
        configurable: true
    });
    SpawnManager.prototype.accessMemory = function () {
        if (this.mainRoom.memory.spawnManager == null)
            this.mainRoom.memory.spawnManager = {
                debug: false,
                verbose: false,
                queue: null
            };
        return this.mainRoom.memory.spawnManager;
    };
    SpawnManager.prototype.AddToQueue = function (body, memory, count) {
        if (count === void 0) { count = 1; }
        if (Memory['verbose'] || this.memory.verbose && count > 0)
            console.log('[' + this.mainRoom.name + '] ' + 'SpawnManager.AddToQueue(): ' + memory['role'] + ': ' + count);
        for (var i = 0; i < count; i++)
            this.queue.push({ body: body, memory: memory });
    };
    SpawnManager.prototype.spawn = function () {
        if (Memory['verbose'] || this.memory.verbose)
            console.log('[' + this.mainRoom.name + '] ' + 'SpawnManager.spawn(): queue.length is ' + this.queue.length);
        if (Memory['debug'] || this.memory.debug)
            this.memory.queue = JSON.parse(JSON.stringify(this.queue));
        if (this.queue.length == 0) {
            this.isIdle = true;
            return;
        }
        this.queue.reverse();
        for (var idx in this.mainRoom.spawnNames) {
            var spawn = Game.spawns[this.mainRoom.spawnNames[idx]];
            if (Memory['verbose'] || this.memory.verbose)
                console.log('[' + this.mainRoom.name + '] ' + 'SpawnManager.spawn(): Spawn: ' + spawn.name);
            if (this.queue.length == 0) {
                if (Memory['verbose'] || this.memory.verbose)
                    console.log('[' + this.mainRoom.name + '] ' + 'SpawnManager.spawn(): shouldn\'t get here');
                break;
            }
            var queueItem = this.queue[this.queue.length - 1];
            if (Memory['verbose'] || this.memory.verbose)
                console.log('[' + this.mainRoom.name + '] ' + 'SpawnManager.spawn(): Last item: ' + queueItem.memory['role'] + ': ' + queueItem.body.join(', '));
            // TODO not only try the last queue item
            if (spawn.spawning == null) {
                if (Memory['verbose'] || this.memory.verbose)
                    console.log('[' + this.mainRoom.name + '] ' + 'SpawnManager.spawn(): Spawn is not busy');
                var creepMemory = queueItem.memory;
                creepMemory.mainRoomName = this.mainRoom.name;
                var result = spawn.createCreep(queueItem.body, null, creepMemory);
                if (Memory['verbose'] || this.memory.verbose)
                    console.log('[' + this.mainRoom.name + '] ' + 'SpawnManager.spawn(): Spawn result: ' + result);
                if (Memory['verbose'] || this.memory.verbose)
                    console.log('[' + this.mainRoom.name + '] ' + 'spawn.createCreepResult: ' + result);
                if (_.isString(result))
                    this.queue.pop();
            }
            else {
                if (Memory['verbose'] || this.memory.verbose)
                    console.log('[' + this.mainRoom.name + '] ' + 'SpawnManager.spawn(): Spawn is busy');
            }
        }
        this.queue = [];
    };
    return SpawnManager;
}());
exports.SpawnManager = SpawnManager;
var MyTower = (function () {
    function MyTower(tower, mainRoom) {
        this.tower = tower;
        this.mainRoom = mainRoom;
    }
    MyTower.prototype.tick = function () {
        var _this = this;
        var closestHostile = this.tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS, { filter: function (e) { return e.owner.username !== 'Source Keeper'; } });
        if (closestHostile != null) {
            this.tower.attack(closestHostile);
            return;
        }
        var healTarget = this.tower.pos.findClosestByRange(FIND_MY_CREEPS, { filter: function (c) { return c.hits < c.hitsMax; } });
        if (healTarget != null) {
            this.tower.heal(healTarget);
            return;
        }
        var repairTarget = this.tower.room.find(FIND_STRUCTURES, { filter: function (x) { return _this.mainRoom.creepManagers.repairManager.targetDelegate(x) && !_this.mainRoom.creepManagers.repairManager.forceStopRepairDelegate(x); } })[0];
        if (repairTarget != null && this.tower.energy > this.tower.energyCapacity / 2) {
            this.tower.repair(repairTarget);
            return;
        }
    };
    return MyTower;
}());
exports.MyTower = MyTower;
var ConstructionManager = (function () {
    function ConstructionManager(mainRoom) {
        this.mainRoom = mainRoom;
        this.maxCreeps = 2;
        this.getData();
    }
    ConstructionManager.prototype.getConstruction = function () {
        var constructionSites = Game.constructionSites;
        var extensions = _.filter(constructionSites, function (c) { return c.structureType == STRUCTURE_EXTENSION; });
        if (extensions.length > 0) {
            return extensions[0];
        }
        for (var idx in constructionSites) {
            return constructionSites[idx];
        }
    };
    ConstructionManager.prototype.getData = function () {
        this.creeps = _.filter(this.mainRoom.creeps, function (c) { return c.memory.role == 'constructor'; });
        this.idleCreeps = _.filter(this.creeps, function (c) { return c.memory.targetId == null; });
    };
    ConstructionManager.prototype.checkCreeps = function () {
        this.getData();
        //console.log('idle creeps: ' + this.idleCreeps.length);
        //console.log('active creeps: ' + this.creeps.length);
        var constructionSite = this.getConstruction();
        if (constructionSite != null && (this.creeps.length < this.maxCreeps || this.idleCreeps.length > 0)) {
            for (var idx in this.idleCreeps) {
                var creep = this.idleCreeps[idx];
                creep.memory.targetId = constructionSite.id;
                creep.memory.targetPosition = constructionSite.pos;
            }
            this.idleCreeps = [];
            this.mainRoom.spawnManager.AddToQueue(ConstructorDefinition.getDefinition(this.mainRoom.maxSpawnEnergy).getBody(), { role: 'constructor', targetId: constructionSite.id, targetPosition: constructionSite.pos }, this.maxCreeps - this.creeps.length);
        }
    };
    ConstructionManager.prototype.tick = function () {
        var _this = this;
        this.getData();
        this.creeps.forEach(function (c) { return new Constructor(c, _this.mainRoom).tick(); });
    };
    return ConstructionManager;
}());
exports.ConstructionManager = ConstructionManager;
var UpgradeManager = (function () {
    function UpgradeManager(mainRoom) {
        this.mainRoom = mainRoom;
        this.getData();
    }
    UpgradeManager.prototype.getData = function () {
        this.creeps = _.filter(this.mainRoom.creeps, function (c) { return c.memory.role == 'upgrader'; });
    };
    UpgradeManager.prototype.checkCreeps = function () {
        this.getData();
        if (this.mainRoom.mainContainer != null && Game.rooms[this.mainRoom.name].energyAvailable == Game.rooms[this.mainRoom.name].energyCapacityAvailable && this.mainRoom.spawnManager.queue.length == 0 && this.creeps.length < 2) {
            this.mainRoom.spawnManager.AddToQueue(UpgraderDefinition.getDefinition(this.mainRoom.maxSpawnEnergy).getBody(), { role: 'upgrader' }, 1);
        }
    };
    UpgradeManager.prototype.tick = function () {
        var _this = this;
        this.getData();
        this.creeps.forEach(function (c) { return new Upgrader(c, _this.mainRoom).tick(); });
    };
    return UpgradeManager;
}());
exports.UpgradeManager = UpgradeManager;
//import {ObjectWithMemory} from "../../objectWithMemory";
var RepairManager = (function () {
    function RepairManager(mainRoom) {
        this.maxCreeps = 2;
        this.mainRoom = mainRoom;
        if (this.memory.repairTargets == null || this.memory.emergencyTargets == null) {
            if (this.memory.repairTargets == null)
                this.memory.repairTargets = {};
            if (this.memory.emergencyTargets == null)
                this.memory.emergencyTargets = {};
            this.loadRepairTargets();
        }
        this.getData();
    }
    Object.defineProperty(RepairManager.prototype, "memory", {
        get: function () {
            return this.accessMemory();
        },
        enumerable: true,
        configurable: true
    });
    RepairManager.prototype.accessMemory = function () {
        if (this.mainRoom.memory.repairManager == null)
            this.mainRoom.memory.repairManager = {
                emergencyTargets: {},
                repairTargets: {}
            };
        return this.mainRoom.memory.repairManager;
    };
    RepairManager.prototype.removeFromTargetList = function (target, hashMap) {
        var list = hashMap[target.pos.roomName];
        if (list == null)
            return;
        hashMap[target.pos.roomName] = list.splice(_.findIndex(list, function (x) { return x.id == target.id; }), 1);
    };
    RepairManager.prototype.removeFromTargetLists = function (target) {
        this.removeFromTargetList(target, this.memory.emergencyTargets);
        this.removeFromTargetList(target, this.memory.repairTargets);
    };
    RepairManager.prototype.forceStopRepairDelegate = function (s) {
        return (s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART) && s.hits > 120000 || (s.hits > 0.9 * s.hitsMax);
    };
    RepairManager.prototype.targetDelegate = function (s) {
        return s.structureType != STRUCTURE_RAMPART && s.structureType != STRUCTURE_WALL && s.hits < s.hitsMax || (s.structureType == STRUCTURE_RAMPART || s.structureType == STRUCTURE_WALL) && s.hits < 80000;
    };
    RepairManager.prototype.emergencyTargetDelegate = function (s) {
        return s.hits < s.hitsMax * 0.2 && (s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_ROAD) || s.structureType == STRUCTURE_RAMPART && s.hits < 2000;
    };
    RepairManager.prototype.loadRepairTargets = function (force) {
        if (force === void 0) { force = false; }
        if (!force && (Game.time % 100) != 0)
            return;
        for (var idx in _.filter(this.mainRoom.allRooms, function (x) { return x.canHarvest(); })) {
            var myRoom = this.mainRoom.allRooms[idx];
            var room = Game.rooms[myRoom.name];
            //console.log('repair targets for myroom' + myRoom.name);
            if (room) {
                //console.log('repair targets for ' + room.name);
                this.memory.repairTargets[myRoom.name] = room.find(FIND_STRUCTURES, { filter: this.targetDelegate });
                this.memory.emergencyTargets[myRoom.name] = _.filter(this.memory.repairTargets[myRoom.name], this.emergencyTargetDelegate);
            }
        }
    };
    RepairManager.prototype.findRepairTargetInList = function (pos, repairTargets) {
        var sameRoomTarget = this.getClosestSameRoomTargetFor(pos, repairTargets, false);
        if (sameRoomTarget)
            return sameRoomTarget;
        for (var roomName in repairTargets) {
            if (this.memory.emergencyTargets[roomName].length > 0)
                return this.memory.emergencyTargets[roomName][0];
        }
        return null;
    };
    RepairManager.prototype.findRepairTarget = function (pos) {
        var target = this.findRepairTargetInList(pos, this.memory.emergencyTargets);
        if (target)
            return target;
        else
            return this.findRepairTargetInList(pos, this.memory.repairTargets);
    };
    RepairManager.prototype.getClosestSameRoomTargetFor = function (pos, repairTargets, pathSorting) {
        if (repairTargets == null || repairTargets[pos.roomName] == null)
            return null;
        if (repairTargets[pos.roomName].length == 0)
            return null;
        var position = new RoomPosition(pos.x, pos.y, pos.roomName);
        if (pathSorting)
            return position.findClosestByPath(repairTargets[pos.roomName]);
        else
            return position.findClosestByRange(repairTargets[pos.roomName]);
    };
    RepairManager.prototype.getData = function () {
        this.creeps = _.filter(this.mainRoom.creeps, function (c) { return c.memory.role == 'repairer'; });
        this.idleCreeps = _.filter(this.creeps, function (c) { return c.memory.repairTarget == null; });
    };
    RepairManager.prototype.checkCreeps = function () {
        if (!this.mainRoom.mainContainer)
            return;
        this.loadRepairTargets();
        this.getData();
        for (var idx in this.creeps) {
            var creep = this.creeps[idx];
            var targetMemory = creep.memory;
            if (targetMemory.repairTarget == null)
                continue;
            var target = Game.getObjectById(targetMemory.repairTarget.id);
            if (!target && Game.rooms[targetMemory.repairTarget.pos.roomName]) {
                this.removeFromTargetLists(targetMemory.repairTarget);
                targetMemory.repairTarget = null;
                this.idleCreeps.push(creep);
            }
            else if (target && !this.emergencyTargetDelegate(target) && !this.forceStopRepairDelegate(target)) {
                this.removeFromTargetList(targetMemory.repairTarget, this.memory.emergencyTargets);
            }
            else if (target && this.forceStopRepairDelegate(target)) {
                this.removeFromTargetLists(targetMemory.repairTarget);
                targetMemory.repairTarget = null;
                this.idleCreeps.push(creep);
            }
        }
        var maxCreeps = ~~_.sum(_.map(this.memory.emergencyTargets, function (x) { return x.length; })) / 10;
        maxCreeps = maxCreeps < this.maxCreeps ? this.maxCreeps : maxCreeps;
        if ((this.creeps.length < this.maxCreeps || this.idleCreeps.length > 0)) {
            for (var idx in this.idleCreeps) {
                var creepMemory = this.idleCreeps[idx].memory;
                var repairTarget = this.findRepairTarget(this.idleCreeps[idx].pos);
                creepMemory.repairTarget = repairTarget;
            }
            this.idleCreeps = [];
            this.mainRoom.spawnManager.AddToQueue(RepairerDefinition.getDefinition(this.mainRoom.maxSpawnEnergy).getBody(), { role: 'repairer' }, this.maxCreeps - this.creeps.length);
        }
    };
    RepairManager.prototype.tick = function () {
        var _this = this;
        this.getData();
        if (Game.time % 100 == 0)
            this.loadRepairTargets();
        this.creeps.forEach(function (c) { return new Repairer(c, _this.mainRoom).tick(); });
    };
    return RepairManager;
}());
exports.RepairManager = RepairManager;
var HarvestingManager = (function () {
    function HarvestingManager(mainRoom) {
        this.mainRoom = mainRoom;
        this.getData();
    }
    Object.defineProperty(HarvestingManager.prototype, "memory", {
        get: function () {
            return this.accessMemory();
        },
        enumerable: true,
        configurable: true
    });
    HarvestingManager.prototype.accessMemory = function () {
        if (this.mainRoom.memory.harvestingManager == null)
            this.mainRoom.memory.harvestingManager = {
                debug: false,
                verbose: false
            };
        return this.mainRoom.memory.harvestingManager;
    };
    HarvestingManager.prototype.placeSourceContainers = function () {
        if (Game.time % 50 != 0)
            return;
        if (this.mainRoom.mainContainer)
            for (var idx in this.mainRoom.sources) {
                var sourceInfo = this.mainRoom.sources[idx];
                if (sourceInfo.memory.keeper)
                    continue;
                if (!sourceInfo.memory.keeper && sourceInfo.containerMissing()) {
                    var path = sourceInfo.pos.findPathTo(this.mainRoom.mainContainer.pos, { ignoreCreeps: true });
                    var containerPosition = new RoomPosition(path[0].x, path[0].y, sourceInfo.pos.roomName);
                    containerPosition.createConstructionSite(STRUCTURE_CONTAINER);
                }
            }
    };
    HarvestingManager.prototype.getData = function () {
        this.harvesterCreeps = _.filter(this.mainRoom.creeps, function (c) { return c.memory.role == 'harvester'; });
        this.idleHarvesterCreeps = _.filter(this.harvesterCreeps, function (c) { return c.memory.sourceId == null; });
        this.sourceCarrierCreeps = _.filter(this.mainRoom.creeps, function (c) { return c.memory.role == 'sourceCarrier'; });
        this.idleSourceCarrierCreeps = _.filter(this.sourceCarrierCreeps, function (c) { return c.memory.sourceId == null; });
    };
    HarvestingManager.prototype.getHarvesterBodyAndCount = function (sourceInfo) {
        var partsRequired = Math.ceil(sourceInfo.memory.energyCapacity / ENERGY_REGEN_TIME);
        var maxWorkParts = HarvesterDefinition.getDefinition(this.mainRoom.maxSpawnEnergy, sourceInfo.memory.containerId != null).work;
        if (maxWorkParts >= partsRequired)
            return { body: HarvesterDefinition.getDefinition(this.mainRoom.maxSpawnEnergy, sourceInfo.memory.containerId != null, partsRequired), count: 1 };
        else {
            var creepCount = Math.min(Math.ceil(partsRequired / maxWorkParts), sourceInfo.memory.harvestingSpots);
            partsRequired = Math.min(Math.ceil(partsRequired / creepCount), maxWorkParts);
            return { body: HarvesterDefinition.getDefinition(this.mainRoom.maxSpawnEnergy, sourceInfo.memory.containerId != null, partsRequired), count: creepCount };
        }
    };
    HarvestingManager.prototype.getSourceCarrierBodyAndCount = function (sourceInfo) {
        var useRoads = (sourceInfo.memory.mainContainerRoadBuiltTo == this.mainRoom.name);
        var pathLengh = sourceInfo.memory.mainContainerPathLength;
        if (pathLengh == null)
            pathLengh = sourceInfo.calculatePathLengthToMainContainer();
        if (pathLengh == null) {
            return {
                body: SourceCarrierDefinition.getDefinition(500),
                count: 0
            };
        }
        var energyPerTick = sourceInfo.memory.energyCapacity / ENERGY_REGEN_TIME;
        var requiredCarryModules = Math.ceil(pathLengh * (useRoads ? 2 : 3) * energyPerTick / 50);
        var maxCarryParts = SourceCarrierDefinition.getDefinition(this.mainRoom.maxSpawnEnergy, requiredCarryModules).carry;
        if (maxCarryParts >= requiredCarryModules)
            return { body: SourceCarrierDefinition.getDefinition(this.mainRoom.maxSpawnEnergy, requiredCarryModules), count: 1 };
        else {
            var creepCount = Math.ceil(requiredCarryModules / maxCarryParts);
            requiredCarryModules = Math.ceil(requiredCarryModules / creepCount);
            return { body: SourceCarrierDefinition.getDefinition(this.mainRoom.maxSpawnEnergy, requiredCarryModules), count: creepCount };
        }
    };
    HarvestingManager.prototype.checkCreeps = function () {
        this.getData();
        if (Memory['verbose'] || this.memory.verbose)
            console.log('HarvestingManager.checkCreeps()');
        for (var idx in this.mainRoom.sources) {
            var sourceInfo = this.mainRoom.sources[idx];
            if (Memory['verbose'] || this.memory.verbose)
                console.log('HarvestingManager.checkCreeps(): Source [' + sourceInfo.id + ']');
            if (!Colony.getRoom(sourceInfo.pos.roomName).canHarvest()) {
                if (Memory['verbose'] || this.memory.verbose)
                    console.log('HarvestingManager.checkCreeps(): We can\'t mine in this room');
                continue;
            }
            if (sourceInfo.memory.keeper) {
                if (Memory['verbose'] || this.memory.verbose)
                    console.log('HarvestingManager.checkCreeps(): Skipping the source keeper');
                continue;
            }
            var harvesters = _.filter(this.harvesterCreeps, function (c) { return c.memory.sourceId == sourceInfo.id; });
            if (Memory['verbose'] || this.memory.verbose)
                console.log('HarvestingManager.checkCreeps(): Harvesters: ' + harvesters.length + ', Harvesting spots: ' + sourceInfo.memory.harvestingSpots);
            //if (harvesters.length < sourceInfo.memory.harvestingSpots) {
            if (Memory['verbose'] || this.memory.verbose)
                console.log('HarvestingManager.checkCreeps(): Add harvester to queue');
            var requirements = this.getHarvesterBodyAndCount(sourceInfo);
            this.mainRoom.spawnManager.AddToQueue(requirements.body.getBody(), { role: 'harvester', sourceId: sourceInfo.id }, Math.min(requirements.count, sourceInfo.memory.harvestingSpots + (sourceInfo.memory.containerId == null ? 1 : 0)) - harvesters.length);
            //}
            if (sourceInfo.memory.containerId && this.mainRoom.mainContainer && sourceInfo.memory.containerId != this.mainRoom.mainContainer.id) {
                var sourceCarriers = _.filter(this.sourceCarrierCreeps, function (c) { return c.memory.sourceId == sourceInfo.id; });
                var requirements_1 = this.getSourceCarrierBodyAndCount(sourceInfo);
                this.mainRoom.spawnManager.AddToQueue(requirements_1.body.getBody(), { role: 'sourceCarrier', sourceId: sourceInfo.id }, Math.min(requirements_1.count, 2) - sourceCarriers.length);
            }
        }
    };
    HarvestingManager.prototype.tick = function () {
        var _this = this;
        this.getData();
        this.harvesterCreeps.forEach(function (c) { return new Harvester(c, _this.mainRoom).tick(); });
        this.sourceCarrierCreeps.forEach(function (c) { return new SourceCarrier(c, _this.mainRoom).tick(); });
    };
    return HarvestingManager;
}());
exports.HarvestingManager = HarvestingManager;
var SpawnFillManager = (function () {
    function SpawnFillManager(mainRoom) {
        this.mainRoom = mainRoom;
        this.getData();
    }
    SpawnFillManager.prototype.checkCreeps = function () {
        if (this.mainRoom.mainContainer != null && _.size(_.filter(Game.creeps, function (c) { return c.memory.role == 'spawnFiller'; })) < 2) {
            this.mainRoom.spawnManager.AddToQueue(SpawnFillerDefinition.getDefinition(this.mainRoom.maxSpawnEnergy).getBody(), { role: 'spawnFiller' }, 1);
        }
    };
    SpawnFillManager.prototype.getData = function () {
        this.creeps = _.filter(this.mainRoom.creeps, function (c) { return c.memory.role == 'spawnFiller'; });
    };
    SpawnFillManager.prototype.tick = function () {
        var _this = this;
        this.getData();
        this.creeps.forEach(function (c) { return new SpawnFiller(c, _this.mainRoom).tick(); });
    };
    return SpawnFillManager;
}());
exports.SpawnFillManager = SpawnFillManager;
var DefenseManager = (function () {
    function DefenseManager(mainRoom) {
        this.maxCreeps = 2;
        this.mainRoom = mainRoom;
    }
    DefenseManager.prototype.checkCreeps = function () {
        this.getData();
        if (_.filter(this.mainRoom.allRooms, function (r) { return r.memory.hostiles && r.canHarvest; }).length > 0 && this.creeps.length < this.maxCreeps) {
            this.mainRoom.spawnManager.AddToQueue(DefenderDefinition.getDefinition(this.mainRoom.maxSpawnEnergy).getBody(), { role: 'defender' }, this.maxCreeps - this.creeps.length);
        }
    };
    DefenseManager.prototype.tick = function () {
        var _this = this;
        this.getData();
        this.creeps.forEach(function (c) { return new Defender(c, _this.mainRoom).tick(); });
    };
    DefenseManager.prototype.getData = function () {
        this.creeps = _.filter(this.mainRoom.creeps, function (c) { return c.memory.role == 'defender'; });
    };
    return DefenseManager;
}());
exports.DefenseManager = DefenseManager;
var ReservationManager = (function () {
    function ReservationManager(mainRoom) {
        this.mainRoom = mainRoom;
    }
    ReservationManager.prototype.checkCreeps = function () {
        if (Memory['verbose'] == true)
            console.log('ReservationManager.checkCreep');
        if (this.mainRoom.maxSpawnEnergy < 1300) {
            if (Memory['verbose'] == true)
                console.log('ReservationManager.checkCreep: Max Energy too low, ' + this.mainRoom.maxSpawnEnergy);
            return;
        }
        this.getData();
        var _loop_2 = function() {
            var myRoom = this_1.mainRoom.connectedRooms[idx];
            var room = Game.rooms[myRoom.name];
            if (room && room.controller.reservation != null && room.controller.reservation.ticksToEnd > 300)
                return "continue";
            if (Memory['verbose'] == true)
                console.log('ReservationManager.checkCreep: Room ' + myRoom.name);
            if (_.filter(this_1.creeps, function (x) { return x.memory.targetRoomName == myRoom.name; }).length == 0) {
                this_1.mainRoom.spawnManager.AddToQueue([CLAIM, CLAIM, MOVE, MOVE], { role: 'reserver', targetRoomName: myRoom.name });
            }
        };
        var this_1 = this;
        for (var idx in _.filter(this.mainRoom.connectedRooms, function (r) { return r.canHarvest() == true && !r.memory.hostiles; })) {
            var state_2 = _loop_2();
            if (state_2 === "continue") continue;
        }
    };
    ReservationManager.prototype.tick = function () {
        var _this = this;
        this.getData();
        this.creeps.forEach(function (c) { return new Reserver(c, _this.mainRoom).tick(); });
    };
    ReservationManager.prototype.getData = function () {
        this.creeps = _.filter(this.mainRoom.creeps, function (c) { return c.memory.role == 'reserver'; });
    };
    return ReservationManager;
}());
exports.ReservationManager = ReservationManager;
var RoadConstructionManager = (function () {
    function RoadConstructionManager(mainRoom) {
        this.mainRoom = mainRoom;
    }
    Object.defineProperty(RoadConstructionManager.prototype, "memory", {
        get: function () {
            return this.accessMemory();
        },
        enumerable: true,
        configurable: true
    });
    RoadConstructionManager.prototype.accessMemory = function () {
        if (this.mainRoom.memory.roadConstructionManager == null)
            this.mainRoom.memory.roadConstructionManager = {
                remainingPath: []
            };
        return this.mainRoom.memory.roadConstructionManager;
    };
    RoadConstructionManager.prototype.buildExtensionRoads = function () {
        if (Game.time % 100 == 0) {
            var extensions = Game.rooms[this.mainRoom.name].find(FIND_MY_STRUCTURES, {
                filter: function (s) { return s.structureType == STRUCTURE_EXTENSION; }
            });
            for (var idx in extensions) {
                var extension = extensions[idx];
                var roomName = this.mainRoom.name;
                new RoomPosition(extension.pos.x - 1, extension.pos.y, roomName).createConstructionSite(STRUCTURE_ROAD);
                new RoomPosition(extension.pos.x + 1, extension.pos.y, roomName).createConstructionSite(STRUCTURE_ROAD);
                new RoomPosition(extension.pos.x, extension.pos.y - 1, roomName).createConstructionSite(STRUCTURE_ROAD);
                new RoomPosition(extension.pos.x, extension.pos.y + 1, roomName).createConstructionSite(STRUCTURE_ROAD);
            }
        }
    };
    RoadConstructionManager.prototype.constructRoad = function (path, startIdx, endIdx) {
        if (startIdx === void 0) { startIdx = 0; }
        if (endIdx === void 0) { endIdx = null; }
        if (endIdx == null)
            var end = path.length - 1;
        else
            end = endIdx;
        for (var pathIdx = startIdx; pathIdx <= end; pathIdx++) {
            var result = path[pathIdx].createConstructionSite(STRUCTURE_ROAD);
            if (result == ERR_FULL) {
                this.memory.remainingPath = path.slice(pathIdx);
                break;
            }
        }
    };
    RoadConstructionManager.prototype.buildHarvestPaths = function () {
        var _this = this;
        if (_.filter(Game.constructionSites, function (x) { return x.structureType == STRUCTURE_ROAD; }).length > 0)
            return;
        if (!this.mainRoom.mainContainer)
            return;
        var sources = _.filter(this.mainRoom.sources, function (x) { return x.memory.containerId != null && (x.memory.mainContainerRoadBuiltTo != _this.mainRoom.name || (Game.time % 500 == 0)) && x.myRoom.canHarvest(); });
        for (var sourceIdx = 0; sourceIdx < sources.length; sourceIdx++) {
            var source = sources[sourceIdx];
            var sourceContainer = Game.getObjectById(source.memory.containerId);
            if (!sourceContainer)
                continue;
            var path = PathFinder.search(this.mainRoom.mainContainer.pos, { pos: sourceContainer.pos, range: 1 });
            this.constructRoad(path.path, 0);
            source.memory.mainContainerRoadBuiltTo = this.mainRoom.name;
            break;
        }
    };
    RoadConstructionManager.prototype.tick = function () {
        if (this.memory.remainingPath && this.memory.remainingPath.length > 0) {
            var remainingPath = this.memory.remainingPath;
            this.memory.remainingPath = null;
            this.constructRoad(remainingPath);
        }
        else if (Game.time % 50 == 0 && !(Game.time % 100 == 0)) {
            this.buildExtensionRoads();
        }
        else if (Game.time % 100 == 0) {
            this.buildHarvestPaths();
        }
    };
    return RoadConstructionManager;
}());
exports.RoadConstructionManager = RoadConstructionManager;
var Scout = (function () {
    function Scout(creep) {
        this.creep = creep;
        this.memory = creep.memory;
    }
    Scout.prototype.tick = function () {
        this.memory = this.creep.memory;
        var pos = this.creep.pos;
        if (pos.roomName != this.memory.targetRoomName || pos.x < 10 || pos.x > 40 || pos.y < 10 || pos.y > 40) {
            //let path = this.creep.pos.findPathTo(new RoomPosition(25, 25, this.memory.targetRoomName), { ignoreDestructibleStructures: true });
            this.creep.moveTo(new RoomPosition(25, 25, this.memory.targetRoomName));
        }
        if (pos.x == 0 || pos.x == 49 || pos.y == 0 || pos.y == 49 || (Game.time % 10) == 0) {
            this.creep.say('Scanning');
            var myRoom = Colony.getRoom(pos.roomName);
            myRoom.scan();
        }
    };
    return Scout;
}());
exports.Scout = Scout;
var Body = (function () {
    function Body() {
    }
    Body.prototype.getBody = function () {
        var body = [];
        for (var i = 0; i < this.tough; i++)
            body.push(TOUGH);
        for (var i = 0; i < this.claim; i++)
            body.push(CLAIM);
        for (var i = 0; i < this.ranged_attack; i++)
            body.push(RANGED_ATTACK);
        for (var i = 0; i < this.attack; i++)
            body.push(ATTACK);
        for (var i = 0; i < this.work; i++)
            body.push(WORK);
        for (var i = 0; i < this.heal; i++)
            body.push(HEAL);
        for (var i = 0; i < this.carry; i++)
            body.push(CARRY);
        for (var i = 0; i < this.move; i++)
            body.push(MOVE);
        return body;
    };
    return Body;
}());
exports.Body = Body;
var Constructor = (function () {
    function Constructor(creep, mainRoom) {
        this.creep = creep;
        this.memory = this.creep.memory;
        this.mainRoom = mainRoom;
        this.target = Game.getObjectById(this.memory.targetId);
        if (this.target != null) {
            this.creep.memory.targetPosition = this.target.pos;
            this.targetPosition = this.target.pos;
            this.memory.targetPosition = this.targetPosition;
        }
        else if (this.creep.memory.targetId != null) {
            this.targetPosition = new RoomPosition(this.memory.targetPosition.x, this.memory.targetPosition.y, this.memory.targetPosition.roomName);
            if (Game.rooms[this.targetPosition.roomName] != null) {
                this.targetPosition = null;
                this.target = null;
                this.memory.targetId = null;
                this.memory.targetId = null;
                this.memory.targetPosition = null;
            }
        }
    }
    Constructor.prototype.construct = function () {
        if (this.target != null) {
            if (this.creep.build(this.target) == ERR_NOT_IN_RANGE)
                this.creep.moveTo(this.target);
        }
        else {
            this.creep.moveTo(this.targetPosition);
        }
    };
    Constructor.prototype.upgrade = function () {
        if (this.creep.upgradeController(this.creep.room.controller) == ERR_NOT_IN_RANGE)
            this.creep.moveTo(this.creep.room.controller);
    };
    Constructor.prototype.tick = function () {
        this.memory = this.creep.memory;
        if (this.creep.carry.energy > 0) {
            if (this.targetPosition != null)
                this.construct();
            else
                this.upgrade();
        }
        else {
            if (this.mainRoom == null)
                return;
            var mainContainer;
            this.mainRoom.mainContainer && (mainContainer = Game.getObjectById(this.mainRoom.mainContainer.id));
            if (mainContainer != null) {
                if (mainContainer.store.energy > 100)
                    if (mainContainer.transfer(this.creep, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE)
                        this.creep.moveTo(mainContainer);
            }
            else {
                if (this.mainRoom.spawnManager.queue.length == 0) {
                    for (var spawnName in Game.spawns) {
                        var spawn = Game.spawns[spawnName];
                        break;
                    }
                    if (spawn.transferEnergy(this.creep) == ERR_NOT_IN_RANGE)
                        this.creep.moveTo(spawn);
                }
            }
        }
    };
    return Constructor;
}());
exports.Constructor = Constructor;
var ConstructorDefinition;
(function (ConstructorDefinition) {
    function getDefinition(maxEnergy) {
        var body = new Body();
        body.work = 1;
        body.carry = 1;
        body.move = 1;
        var remainingEnergy = Math.min(maxEnergy, 1500);
        var remaining = remainingEnergy - 200;
        while (remaining >= 100) {
            if (remaining >= 150) {
                body.carry++;
                body.carry++;
                body.move++;
                remaining -= 150;
            }
            else if (remaining >= 100) {
                body.carry++;
                body.move++;
                remaining -= 100;
            }
        }
        return body;
    }
    ConstructorDefinition.getDefinition = getDefinition;
})(ConstructorDefinition = exports.ConstructorDefinition || (exports.ConstructorDefinition = {}));
var Upgrader = (function () {
    function Upgrader(creep, mainRoom) {
        this.creep = creep;
        this.mainRoom = mainRoom;
    }
    Upgrader.prototype.upgrade = function () {
        if (this.creep.upgradeController(this.creep.room.controller) == ERR_NOT_IN_RANGE)
            this.creep.moveTo(this.creep.room.controller);
    };
    Upgrader.prototype.tick = function () {
        if (this.creep.carry.energy > 0) {
            this.upgrade();
        }
        else {
            if (!this.mainRoom)
                return;
            var mainContainer = Game.getObjectById(this.mainRoom.mainContainer.id);
            if (mainContainer != null) {
                if (mainContainer.store.energy > 200)
                    if (mainContainer.transfer(this.creep, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE)
                        this.creep.moveTo(mainContainer);
            }
            else {
                if (this.mainRoom.spawnManager.isIdle) {
                    for (var spawnName in Game.spawns) {
                        var spawn = Game.spawns[spawnName];
                    }
                    if (spawn.transferEnergy(this.creep) == ERR_NOT_IN_RANGE)
                        this.creep.moveTo(spawn);
                }
            }
        }
    };
    return Upgrader;
}());
exports.Upgrader = Upgrader;
var UpgraderDefinition;
(function (UpgraderDefinition) {
    function getDefinition(maxEnergy) {
        var body = new Body();
        var remainingEnergy = Math.min(maxEnergy, 1500);
        var basicModuleCount = ~~(remainingEnergy / 300);
        body.work = basicModuleCount * 2;
        body.carry = basicModuleCount * 1;
        body.move = basicModuleCount * 1;
        var remaining = maxEnergy - basicModuleCount * 300;
        while (remaining >= 100) {
            if (remaining >= 300) {
                body.work++;
                body.carry++;
                body.carry++;
                body.carry++;
                body.move++;
                remaining -= 300;
            }
            else if (remaining >= 150) {
                body.work++;
                body.move++;
                remaining -= 150;
            }
            else if (remaining >= 50) {
                body.carry++;
                remaining -= 50;
            }
        }
        return body;
    }
    UpgraderDefinition.getDefinition = getDefinition;
})(UpgraderDefinition = exports.UpgraderDefinition || (exports.UpgraderDefinition = {}));
var Repairer = (function () {
    function Repairer(creep, mainRoom) {
        this.creep = creep;
        this.mainRoom = mainRoom;
        this.memory = this.creep.memory;
    }
    Repairer.prototype.refill = function () {
        var container = this.mainRoom.mainContainer;
        if (container && container.transfer(this.creep, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE)
            this.creep.moveTo(container);
    };
    Repairer.prototype.tick = function () {
        this.memory = this.creep.memory;
        this.creep.say('REPAIR');
        if (this.creep.carry.energy == 0) {
            this.refill();
        }
        else {
            var repairTarget = null;
            this.memory.repairTarget && (repairTarget = Game.getObjectById(this.memory.repairTarget.id));
            if (repairTarget) {
                var result = this.creep.repair(repairTarget);
                this.creep.say('' + result);
                if (result == ERR_NOT_IN_RANGE)
                    this.creep.moveTo(repairTarget);
            }
            else {
                if (this.memory.repairTarget && this.creep.room.name != this.memory.repairTarget.pos.roomName) {
                    this.creep.moveTo(new RoomPosition(this.memory.repairTarget.pos.x, this.memory.repairTarget.pos.y, this.memory.repairTarget.pos.roomName));
                }
            }
        }
    };
    return Repairer;
}());
exports.Repairer = Repairer;
var RepairerDefinition;
(function (RepairerDefinition) {
    function getDefinition(maxEnergy) {
        var body = new Body();
        var remainingEnergy = Math.min(maxEnergy, 1500);
        if (remainingEnergy < 400) {
            body.work = 1;
            body.carry = 2;
            body.move = 2;
        }
        else {
            var basicModulesCount = ~~(remainingEnergy / 400); //work,carry,carry,move,move
            if (basicModulesCount > 5)
                basicModulesCount = 5;
            body.work = 2 * basicModulesCount;
            body.carry = 2 * basicModulesCount;
            body.move = 2 * basicModulesCount;
            var remaining = remainingEnergy - 400 * basicModulesCount;
            while (remaining >= 100) {
                if (remaining >= 200) {
                    body.work++;
                    body.carry++;
                    ;
                    body.move++;
                    ;
                    remaining -= 200;
                }
                else if (remaining >= 100) {
                    body.carry++;
                    body.move++;
                    remaining -= 100;
                }
            }
        }
        return body;
    }
    RepairerDefinition.getDefinition = getDefinition;
})(RepairerDefinition = exports.RepairerDefinition || (exports.RepairerDefinition = {}));
var Harvester = (function () {
    function Harvester(creep, mainRoom) {
        this.creep = creep;
        this.mainRoom = mainRoom;
        this.memory = creep.memory;
        this.loadFromMemory();
    }
    Harvester.prototype.getSourcePosition = function () {
        this.source = Game.getObjectById(this.sourceId);
        if (this.source == null)
            this.sourcePosition = this.source.pos;
        else
            this.sourcePosition = this.mainRoom.sources[this.sourceId].pos;
    };
    Harvester.prototype.harvest = function () {
        var source = Game.getObjectById(this.sourceId);
        if (source != null) {
            if (this.creep.harvest(source) == ERR_NOT_IN_RANGE)
                this.creep.moveTo(source);
            this.sourceContainerDropOff(true);
        }
        else {
            this.creep.moveTo(this.sourcePosition);
        }
    };
    Harvester.prototype.sourceContainerDropOff = function (dontMove) {
        if (dontMove === void 0) { dontMove = false; }
        var container = null;
        try {
            this.mainRoom.sources[this.sourceId].memory.containerId && (container = Game.getObjectById(this.mainRoom.sources[this.sourceId].memory.containerId));
            if (container) {
                var result = this.creep.transfer(container, RESOURCE_ENERGY);
                if (result == ERR_NOT_IN_RANGE && !dontMove)
                    this.creep.moveTo(container);
                return true;
            }
        }
        catch (e) {
            this.creep.say(this.sourceId);
        }
        return false;
    };
    Harvester.prototype.dropOff = function () {
        if (this.mainRoom.creepManagers.harvestingManager.sourceCarrierCreeps.length == 0 || !this.sourceContainerDropOff()) {
            var dropOffContainer = this.mainRoom.mainContainer;
            if (dropOffContainer == null || this.mainRoom.creepManagers.spawnFillManager.creeps.length == 0 || this.mainRoom.creepManagers.harvestingManager.sourceCarrierCreeps.length == 0) {
                for (var spawnName in Game.spawns) {
                    dropOffContainer = Game.spawns[spawnName];
                }
            }
            if (this.creep.transfer(dropOffContainer, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE)
                this.creep.moveTo(dropOffContainer);
        }
    };
    Harvester.prototype.tick = function () {
        this.memory = this.creep.memory;
        if (this.creep.carry.energy < this.creep.carryCapacity) {
            this.harvest();
        }
        else {
            this.dropOff();
        }
    };
    Harvester.prototype.loadFromMemory = function () {
        this.sourceId = this.memory.sourceId;
        this.mainRoom = Colony.mainRooms[this.memory.mainRoomName];
    };
    Harvester.prototype.saveToMemory = function () {
        this.memory.mainRoomName = this.mainRoom.name;
    };
    return Harvester;
}());
exports.Harvester = Harvester;
var HarvesterDefinition;
(function (HarvesterDefinition) {
    function getHarvesterDefinition(maxEnergy, maxWorkParts) {
        var body = new Body();
        var remainingEnergy = Math.min(maxEnergy, 1500);
        var basicModulesCount = ~~(remainingEnergy / 200); //work,carry,move
        //if (basicModulesCount==0)
        //    return ['work','carry','carry','move','move'];
        body.work = basicModulesCount;
        body.carry = basicModulesCount;
        body.move = basicModulesCount;
        var remaining = remainingEnergy - basicModulesCount * 200;
        while (remaining >= 100) {
            if (remaining >= 150) {
                body.carry++;
                body.carry++;
                body.move++;
                remaining -= 150;
            }
            else if (remaining >= 100) {
                body.carry++;
                body.move++;
                remaining -= 100;
            }
        }
        return body;
    }
    function getMinerDefinition(maxEnergy, maxWorkParts) {
        var body = new Body();
        body.carry = 2;
        var remainingEnergy = maxEnergy - 2 * BODYPART_COST.carry;
        var basicModulesCount = ~~(remainingEnergy / (2 * BODYPART_COST.work + BODYPART_COST.move)); //work,carry,move
        body.move = basicModulesCount;
        body.work = 2 * basicModulesCount;
        remainingEnergy -= basicModulesCount * (2 * BODYPART_COST.work + BODYPART_COST.move);
        if (remainingEnergy >= (BODYPART_COST.work + BODYPART_COST.move)) {
            body.work++;
            body.move++;
        }
        if (body.work > maxWorkParts) {
            body.work = maxWorkParts;
            body.move = Math.ceil(body.work / 2);
        }
        return body;
    }
    function getDefinition(maxEnergy, hasSourceContainer, maxWorkParts) {
        if (hasSourceContainer === void 0) { hasSourceContainer = false; }
        if (maxWorkParts === void 0) { maxWorkParts = 50; }
        if (!hasSourceContainer)
            return getHarvesterDefinition(maxEnergy, maxWorkParts);
        else
            return getMinerDefinition(maxEnergy, maxWorkParts);
    }
    HarvesterDefinition.getDefinition = getDefinition;
})(HarvesterDefinition = exports.HarvesterDefinition || (exports.HarvesterDefinition = {}));
var SourceCarrier = (function () {
    function SourceCarrier(creep, mainRoom) {
        this.creep = creep;
        this.mainRoom = mainRoom;
        this.memory = this.creep.memory;
        this.mySource = this.mainRoom.sources[this.memory.sourceId];
    }
    SourceCarrier.prototype.pickUp = function () {
        this.memory = this.creep.memory;
        if (this.mySource.pos.roomName != this.creep.room.name)
            this.creep.moveTo(this.mySource);
        else {
            this.sourceContainer = Game.getObjectById(this.mySource.memory.containerId);
            if (this.sourceContainer && this.sourceContainer.transfer(this.creep, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE)
                this.creep.moveTo(this.sourceContainer);
        }
    };
    SourceCarrier.prototype.deliver = function () {
        if (this.creep.room.name == this.mainRoom.name) {
            var tower = this.creep.room.find(FIND_STRUCTURES, { filter: function (x) { return x.structureType == STRUCTURE_TOWER && x.energy < x.energyCapacity * 0.7; } });
            if (tower.length > 0) {
                if (this.creep.transfer(tower[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE)
                    this.creep.moveTo(tower[0]);
                return;
            }
        }
        var mainContainer = this.mainRoom.mainContainer;
        if (mainContainer != null) {
            if (this.creep.transfer(mainContainer, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE)
                this.creep.moveTo(mainContainer);
        }
    };
    SourceCarrier.prototype.tick = function () {
        if (this.creep.carry.energy == 0)
            this.pickUp();
        else
            this.deliver();
    };
    return SourceCarrier;
}());
exports.SourceCarrier = SourceCarrier;
var SourceCarrierDefinition;
(function (SourceCarrierDefinition) {
    function getDefinition(maxEnergy, maxCarryParts) {
        if (maxCarryParts === void 0) { maxCarryParts = 50; }
        var body = new Body();
        var basicModuleCount = ~~(maxEnergy / 150);
        if (basicModuleCount * 3 > 50)
            basicModuleCount = ~~(50 / 3);
        if (basicModuleCount * 2 > maxCarryParts) {
            basicModuleCount = Math.ceil(maxCarryParts / 2);
        }
        body.carry = 2 * basicModuleCount;
        body.move = basicModuleCount;
        return body;
    }
    SourceCarrierDefinition.getDefinition = getDefinition;
})(SourceCarrierDefinition = exports.SourceCarrierDefinition || (exports.SourceCarrierDefinition = {}));
var SpawnFiller = (function () {
    function SpawnFiller(creep, mainRoom) {
        this.creep = creep;
        this.mainRoom = mainRoom;
    }
    SpawnFiller.prototype.refill = function () {
        if (!this.mainRoom)
            return;
        var mainContainer = this.mainRoom.mainContainer;
        if (mainContainer != null) {
            if (mainContainer.transfer(this.creep, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE)
                this.creep.moveTo(mainContainer);
        }
    };
    SpawnFiller.prototype.tick = function () {
        if (this.creep.carry.energy == 0) {
            this.refill();
        }
        else {
            var target = this.creep.pos.findClosestByPath(FIND_MY_STRUCTURES, { filter: function (s) { return (s.structureType == STRUCTURE_SPAWN || s.structureType == STRUCTURE_EXTENSION) && s.energy < s.energyCapacity; } });
            if (target == null)
                this.refill();
            else {
                if (this.creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE)
                    this.creep.moveTo(target);
            }
        }
    };
    return SpawnFiller;
}());
exports.SpawnFiller = SpawnFiller;
var SpawnFillerDefinition;
(function (SpawnFillerDefinition) {
    function getDefinition(maxEnergy) {
        var body = new Body();
        var remainingEnergy = Math.min(maxEnergy, 1500);
        var basicModuleCount = ~~(remainingEnergy / 150);
        basicModuleCount = (basicModuleCount > 8) ? 8 : basicModuleCount;
        body.carry = 2 * basicModuleCount;
        body.move = 1 * basicModuleCount;
        return body;
    }
    SpawnFillerDefinition.getDefinition = getDefinition;
})(SpawnFillerDefinition = exports.SpawnFillerDefinition || (exports.SpawnFillerDefinition = {}));
var Defender = (function () {
    function Defender(creep, mainRoom) {
        this.creep = creep;
        this.mainRoom = mainRoom;
        this.memory = this.creep.memory;
    }
    Defender.prototype.tick = function () {
        var _this = this;
        this.memory = this.creep.memory;
        var closestHostileCreep = this.creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
        if (closestHostileCreep != null) {
            this.creep.moveTo(closestHostileCreep);
            this.creep.attack(closestHostileCreep);
            this.creep.rangedAttack(closestHostileCreep);
        }
        else {
            var otherRoom = _.filter(this.mainRoom.allRooms, function (r) { return r.name != _this.creep.room.name && r.memory.hostiles && r.canHarvest; })[0];
            if (otherRoom != null)
                this.creep.moveTo(new RoomPosition(25, 25, otherRoom.name));
            else {
                this.creep.moveTo(this.mainRoom.mainPosition);
            }
        }
    };
    return Defender;
}());
exports.Defender = Defender;
var DefenderDefinition;
(function (DefenderDefinition) {
    function getDefinition(maxEnergy) {
        var body = new Body();
        var remainingEnergy = Math.min(maxEnergy, 1500);
        var basicModulesCount = ~~(remainingEnergy / 330); //work,carry,move
        body.attack = basicModulesCount;
        body.ranged_attack = basicModulesCount;
        body.move = 2 * basicModulesCount;
        return body;
    }
    DefenderDefinition.getDefinition = getDefinition;
})(DefenderDefinition = exports.DefenderDefinition || (exports.DefenderDefinition = {}));
var Reserver = (function () {
    function Reserver(creep, mainRoom) {
        this.creep = creep;
        this.mainRoom = mainRoom;
        this.memory = creep.memory;
    }
    Reserver.prototype.tick = function () {
        this.memory = this.creep.memory;
        if (this.memory.targetRoomName != this.creep.room.name)
            this.creep.moveTo(new RoomPosition(25, 25, this.memory.targetRoomName));
        else if (this.creep.reserveController(this.creep.room.controller) == ERR_NOT_IN_RANGE)
            this.creep.moveTo(this.creep.room.controller);
    };
    return Reserver;
}());
exports.Reserver = Reserver;
/**
 * Singleton object.
 * Since singleton classes are considered anti-pattern in Typescript, we can effectively use namespaces.
 * Namespace's are like internal modules in your Typescript application. Since GameManager doesn't need multiple instances
 * we can use it as singleton.
 */
var GameManager;
(function (GameManager) {
    function globalBootstrap() {
        // Set up your global objects.
        // This method is executed only when Screeps system instantiated new "global".
        // Use this bootstrap wisely. You can cache some of your stuff to save CPU
        // You should extend prototypes before game loop in here.
        if (Memory['reset'] == true) {
            Memory['reset'] = false;
            Memory['colony'] = {};
            Colony.mainRooms = null;
            Colony.rooms = null;
        }
        console.log('Global reset');
        var startCpu = Game.cpu.getUsed();
        if (!Memory['colony'])
            Memory['colony'] = {};
        var colonyMemory = Memory['colony'];
        Colony.initialize(colonyMemory);
        var endCpu = Game.cpu.getUsed();
        console.log('Booting: ' + (endCpu - startCpu).toFixed(2));
    }
    GameManager.globalBootstrap = globalBootstrap;
    function loop() {
        // Loop code starts here
        // This is executed every tick
        var startCpu = Game.cpu.getUsed();
        for (var name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }
        if (Memory['verbose'])
            console.log('MainLoop');
        Colony.tick();
        var endCpu = Game.cpu.getUsed();
        console.log('Time: ' + Game.time + ' CPU: ' + (endCpu - startCpu).toFixed(2) + ' Bucket: ' + Game.cpu.bucket);
    }
    GameManager.loop = loop;
})(GameManager = exports.GameManager || (exports.GameManager = {}));
/*
* Singleton object. Since GameManager doesn't need multiple instances we can use it as singleton object.
*/
GameManager.globalBootstrap();
// This doesn't look really nice, but Screeps' system expects this method in main.js to run the application.
// If we have this line, we can make sure that globals bootstrap and game loop work.
// http://support.screeps.com/hc/en-us/articles/204825672-New-main-loop-architecture
module.exports.loop = function () {
    GameManager.loop();
};
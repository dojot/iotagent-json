import util = require("util");


/**
 * Event data.
 */
interface DeviceManagerEventData {
  // Device ID.
  id: string;
  [attrs: string] : any;
}

/**
 * Event sent by device manager
 */
interface DeviceManagerEvent {
  // Event type. Self-explanatory.
  event: "created" | "removed" | "updated";
  // The event data. This should be the device data model.
  data: DeviceManagerEventData;
  // Any extra meta-information.
  meta: any;
}

/**
 * Instructions on how to extract device ID
 * from a received message.
 */
interface ResolverInstructions {
  // Where this ID is
  type: "mqtt-topic" | "message-attribute"

  // If 'message-attribute' is selected,
  // this selected which attribute contains the ID
  attribute_name?: string

  // If necessary, this regex will be used
  // to extract the ID. This is valid for both
  // mqtt-topic and message-attribute.
  regexp?: string

  // Physical device ID
  id: string 

  // Any message property besides payload that could indicate message format.
  // This could be, for instance, MQTT topic.
  xid: string
}


/**
 * Class responsible for device cache management and cache lookup
 */
class CacheHandler {

  // The cache.
  // TODO: this would be better placed in a Redis instance.
  cache: {
    [id: string]: any
  }

  constructor() {
    this.cache = {};
  }

  /**
   * Process a new event got from DeviceManager.
   * @param event The received event
   */
  processEvent(event: DeviceManagerEvent) {
    console.log("Received event: " + util.inspect(event, { depth: null}));

    switch (event.event) {
      case "created":
      case "updated":
      console.log("Inserting into cache new device description.");
        this.cache[event.data.id] = event; 
      break;
      case "removed":
      console.log("Removing from cache device description.");
        delete this.cache[event.data.id]
      break;
    }

    console.log("Cache so far: ");
    console.log(util.inspect(this.cache, {depth: null}));
  }

  /**
   * Perform a cache lookup.
   * @param id Device ID
   * @returns The cached device data
   */
  lookup(id: string) : any {
    if (id in this.cache) {
      return this.cache[id];
    } else {
      return null;
    }
  }
};

/**
 * Class responsible for device ID resolution
 * from a received message.
 */
class IdResolver {
  // The cache. 
  cache: {
    [id: string]: ResolverInstructions
  }

  // Map correlating dojot's device ID and physical
  // device ID
  idCache: {
    [id: string]: string
  }

  constructor() {
    this.cache = {};
    this.idCache = {};
  }

  /**
   * Extract all instructions to locate device ID.
   * 
   * @param event The received device manager event
   * @returns A list of instructions to locate physical device ID from
   * a received message.
   */
  extractIdLocations(event: DeviceManagerEvent) : ResolverInstructions[] {
    let ret: ResolverInstructions[] = [];

    for (let templateId in event.data.attrs) {
      for (let templateAttr of event.data.attrs[templateId]) {
        if (templateAttr["label"] === "id-location") {
          ret.push(JSON.parse(templateAttr["static_value"]));
        }
      }
    }

    return ret;
  }

  /**
   * Process a device manager event.
   * 
   * All device ID location instructions will be gathered and 
   * saved to the cache.
   * 
   * @param event The received event.
   */
  processEvent(event: DeviceManagerEvent) {
    let idLocations = this.extractIdLocations(event);

    if (idLocations.length == 0) {
      console.log("No ID location was found.")
      return;
    }

    switch (event.event) {
      case "created":
      case "updated":
        console.log("Inserting into resolver new ID resolution instruction.");
        for (let instruction of idLocations) {
          console.log("Instruction: " + util.inspect(instruction, {depth: null}));
          this.cache[instruction.xid] = instruction;
          this.idCache[instruction.id] = event.data.id;
        }
      break;
      case "removed":
        console.log("Removing from resolver an ID resolution instruction.");
        for (let instruction of idLocations) {
          delete this.cache[instruction.xid];
          delete this.idCache[instruction.id];
        }
      break;
    }

    console.log("Cache so far: ");
    console.log(util.inspect(this.cache, {depth: null}));
    console.log("ID Cache so far: ");
    console.log(util.inspect(this.idCache, {depth: null}));
  }

  /**
   * Resolve dojot's device ID from data sent from the
   * physical device.
   * @param xid Message property value that indicates message format.
   * @param data The received message
   * @param meta Meta-information related to the message. The
   * only attribute used is 'topic', which holds the topic
   * to which the message was published.
   * @returns The associated dojot's device ID
   */
  resolve(xid: string, data?: any, meta?: any) : string {
    let ret = "";

    if (!(xid in this.cache)) {
      console.log("ID " + xid + " was not found in resolver cache.");
      return "";
    }

    let instruction = this.cache[xid];
    let dataSource: string;
    switch (instruction.type) {
      case "mqtt-topic":
         dataSource = meta["topic"];
      break;
      case "message-attribute":
        // TODO: This attribute should be parsed and analyzed in-depth
        if (data !== undefined && instruction.attribute_name !== undefined) { 
          dataSource = data[instruction.attribute_name]; 
        }
        else { dataSource = ""; }
      break;
      default:
        dataSource = "";
    }

    if (instruction.regexp !== undefined) {
      ret = dataSource.replace(new RegExp(instruction.regexp, "g"), "$1");
    } else {
      ret = dataSource;
    }

    if (ret != "") {
      // Transform to dojot's ID
      ret = this.idCache[ret];
    }
    return ret;
  }
};

export { IdResolver }
export { CacheHandler }
export { DeviceManagerEvent }
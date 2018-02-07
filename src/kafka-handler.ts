import util = require("util");
import kafka = require("kafka-node");
import axios, {AxiosResponse, AxiosError} from 'axios';
import config = require("./config");
import {DataBroker, MetaAttribute} from "./data-broker";
import { DeviceManagerEvent } from "./cache";

/**
 * Class responsible for Kafka messaging
 */
export class KafkaHandler implements DataBroker {

  private config: config.ConfigOptions

  // Maps tenants to services to kafka topics
  topicMap: {[tenant: string]: {[service: string]:string}};
  private publishingSubject: string;
  private contextBroker: string;

  // Main producer.
  private producer: kafka.HighLevelProducer;
  private isProducerReady: boolean;

  // Main consumer (device management information).
  private consumer: kafka.ConsumerGroup;
  private dataCallback: (data: DeviceManagerEvent) => void
  private topics: string[];

  private tenancyConsumer: kafka.ConsumerGroup;

  /**
   * @param config The configuration to be used.
   * @param callback A callback that will process received device manager notifications
   */
  constructor(config: config.ConfigOptions, callback: (data: DeviceManagerEvent) => void) {

    if (config.broker.type == 'kafka') {
      this.contextBroker = config.broker.contextBroker ? config.broker.contextBroker : 'http://data-broker';
      this.publishingSubject = config.broker.subject ? config.broker.subject : 'device-data';
    }

    this.dataCallback = callback;
    this.config = config;

    this.topicMap = {};
    this.topics = [];

    // Block any communication before producer is properly created.
    this.isProducerReady = false;
    this.initDataProducer();
    this.initTenantWatcher();

  }

  private bootstrapTenants() {
    axios({
      'url': this.config.tenancy.manager + '/admin/tenants',
      'method': 'get'
    }).then((response: AxiosResponse) => {
      for (let tenant of response.data.tenants) {
        console.log('bootstraping for tenant', tenant);
        this.initDeviceConsumer(tenant);
      }
    }).catch((error: AxiosError) => {
      console.error('Failed to retrieve list of existing tenants.', error);
      console.error('Trying again in a few moments');
      setTimeout( () => { this.bootstrapTenants(); }, 10000);
    })
  }

  private initTenantWatcher() {
    this.getPublishTopic('internal', this.config.tenancy.subject, (err?:any, topic?: string) => {
      if (err || (topic == undefined)) {
        console.error('Failed to retrieve tenancy management topic. ', err);
        process.exit(1);
      }

      this.tenancyConsumer = new kafka.ConsumerGroup(this.config.device_manager.consumerOptions, topic!);
      console.log('... Tenancy consumer ready');
      this.bootstrapTenants();

      // Kafka consumer events registration
      this.tenancyConsumer.on("message", (data) => {
        let parsedData = JSON.parse(data.value.toString());
        this.initDeviceConsumer(parsedData.tenant);
      });
      this.tenancyConsumer.on("error", (err) => {
        console.log("Closing current consumer.");
        this.consumer.close(true, (e) => {
          console.log("Result of consumer close operation: " + e);
          process.exit(1)
        });
      });

      console.log("... Kafka tenancy consumer created and callbacks registered.");
    }, true);
  }

  private initDeviceConsumer(tenant: string) {
    let isScheduled = false;
    console.log("Creating new Kafka client...");
    // First try
    // Creating consumer client - from device manager to iotagent.
    // This is always used.
    console.log("Creating Kafka device watcher...");
    this.getPublishTopic(tenant, this.config.device_manager.inputSubject, (err?:any, topic?: string) => {
      if (err || (topic == undefined)) {
        console.error('Failed to retrieve input topic');
        process.exit(1);
      }

      if (this.consumer){
        this.consumer.close(true, (err) => {});
      }
      this.topics.unshift(topic!);
      this.consumer = new kafka.ConsumerGroup(this.config.device_manager.consumerOptions, this.topics);
      console.log('... device watcher is ready');

      // Kafka consumer events registration
      this.consumer.on("message", (data) => {
        let parsedData = JSON.parse(data.value.toString());
        this.dataCallback(parsedData);
      });
      this.consumer.on("error", (err) => {
        if (isScheduled == true) {
          console.log("An operation was already scheduled. No need to do it again.");
          return;
        }
        console.log("Closing current consumer.");
        this.consumer.close(true, (e) => {
          console.log("Result of consumer close operation: " + e);
        });

        isScheduled = true;
        console.log("Error: ", err);
        console.log("Will try again to create Kafka consumer in a few seconds.");
        setTimeout(() => {
          console.log("Trying again.");
          this.initDeviceConsumer(tenant);
        }, 10000)
      });

      console.log("... Kafka device watcher created and callbacks registered.");
    });
  }

  /**
   * Start Kafka producer.
   *
   * If the producer creation fails, it will be tried again after one second.
   * TODO make retry period (or even attempt) configurable
   *
   * @param client   Kafka clinet
   */
  private initDataProducer() {
    let isScheduled = false;
    if (this.config.broker.type === "kafka") {
      console.log("Creating Kafka producer...");
      let client = new kafka.Client(this.config.broker.host, "iotagent-json-producer-" +  Math.floor(Math.random() * 10000));
      console.log("... Kafka client for producer is ready.");
      this.producer = new kafka.HighLevelProducer(client, { requireAcks: 1 });

      // Kafka producer events registration
      this.producer.on("ready", () => {
        console.log("... Kafka producer creation finished.");
        this.isProducerReady = true;
      });
      this.producer.on("error", (e) => {
        if (isScheduled == true) {
          console.log("An operation was already scheduled. No need to do it again.");
          return;
        }
        this.producer.close();
        isScheduled = true;
        console.error("Error: ", e);
        console.log("Will try again to create Kafka producer in a few seconds.");
          setTimeout(() => {
            console.log("Trying again.");
            this.initDataProducer();
          }, 10000);
      });
      console.log("... Kafka producer created and callbacks registered.");
    }
  }

  /**
   * Generates a JWT for usage on internal requests
   * @param  tenant Tenancy context to be used
   * @return        JWT token string
   */
  private generateJWT(tenant: string) {
    const payload = {
      'service': tenant,
      'username': 'iotagent'
    }
    return (new Buffer('dummy jwt schema').toString('base64')) + '.'
           + (new Buffer(JSON.stringify(payload)).toString('base64')) + '.'
           + (new Buffer('dummy signature').toString('base64'));
  }

  /**
   * Retrieves managed topic id based on given tenant and subject
   * @param  tenant   Tenant for which a topic is to be retrieved
   * @param  subject  Subject of the topic to be retrieved
   * @param  callback Who to call once a topic is obtained
   * @return void
   */
  private getPublishTopic(tenant: string, subject: string,
                          callback: (err?: any, topic?:string) => void,
                          global?:boolean): void {
    if (tenant in this.topicMap) {
      if (subject in this.topicMap[tenant]) {
        callback(undefined, this.topicMap[tenant][subject]);
        return;
      }
    }

    axios({
      'url': this.contextBroker + '/topic/' + subject + (global ? "?global=true" : ""),
      'method': 'get',
      'headers': {'authorization': 'Bearer ' + this.generateJWT(tenant)}
    }).then((response: AxiosResponse) => {
      if (! (this.topicMap[tenant])) {
        this.topicMap[tenant] = {};
      }
      this.topicMap[tenant][subject] = response.data.topic;
      callback(undefined, this.topicMap[tenant][subject]);
    }).catch((error: AxiosError) => {
      callback(error.message, undefined);
    })
  }

  /**
   * sends received device event to configured kafka topic
   * @param  service        Tenant which oversees the device
   * @param  deviceId       Device from which data originated
   * @param  attributes     Actual device data
   * @param  metaAttributes Event metadata
   * @return void
   */
  updateData(service: string, deviceId: string, attributes: any, metaAttributes: MetaAttribute) {
    if (this.isProducerReady === false) {
      console.log("Kafka producer is not yet ready.");
      return;
    }

    if (metaAttributes.TimeInstant != undefined) {
      for (let attr in attributes) {
        // Only timestamp will be updated for now
        attributes[attr]["meta"] = {
          TimeInstant: metaAttributes.TimeInstant
        }
      }
    }

    let updateData: any = {
      "metadata": {
        "deviceid": deviceId,
        "protocol": "mqtt",
        "payload": "json"
      },
      "attrs": attributes
    }

    this.getPublishTopic(service, this.publishingSubject, (err?:any, topic?: string) => {
      if (err || (topic == undefined)) {
        console.error("Failed to determine output topic", err);
        return;
      }

      let message: any = {
        "topic": topic,
        "messages": [JSON.stringify(updateData)]
      }

      console.log("About to update device %s data on [%s]", deviceId, topic);
      this.producer.send([message], (err: any, result: any) => {
        if (err) {
          console.error("Failed to update device data", err);
        } else {
          console.log("message away", result);
        }
      });
    })
  }
}

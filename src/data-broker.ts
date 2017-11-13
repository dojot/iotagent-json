
// Data broker interface
interface DataBroker {
  host: string;

  // updateData function
  updateData(service: string, deviceId: string, attributes: any): void;
}

export {DataBroker};
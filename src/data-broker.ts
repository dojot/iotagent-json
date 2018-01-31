
interface MetaAttribute {
  TimeInstant?: string
}

// Data broker interface
interface DataBroker {
  // sends data to remote interested parties
  updateData(service: string, deviceId: string, attributes: any, metaAttributes: MetaAttribute): void;
}

export {DataBroker};
export {MetaAttribute};

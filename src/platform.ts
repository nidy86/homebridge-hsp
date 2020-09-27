import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import HspPlatformAccessory from './platformAccessory';


export class HspHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {

    this.log = log;
    this.config = config;
    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');

      this.accessories.forEach(function(accessory){
        api.unregisterPlatformAccessories(PLUGIN_NAME,PLATFORM_NAME,[accessory]);
      });
      
      // run the method to discover / register your devices as accessories
      this.discoverDevices();

    });

  }

  
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  
  discoverDevices() {

    const devices = [
      {
        uniqueId: this.api.hap.uuid.generate('HSP-01'),
        displayName: 'HSP Pellet Ofen',
      },
    ];

    for (const device of devices) {

      const uuid = this.api.hap.uuid.generate(device.uniqueId);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
        new HspPlatformAccessory(this, existingAccessory);

      } else {
        this.log.info('Adding new accessory:', device.displayName);

        const accessory = new this.api.platformAccessory(device.displayName, uuid);
        accessory.context.device = device;
        
        new HspPlatformAccessory(this, accessory);

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }

  }
}

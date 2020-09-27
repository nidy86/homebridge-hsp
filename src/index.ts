import { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { PLUGIN_NAME } from './settings';
import { HspHomebridgePlatform } from './platform'; 

export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, HspHomebridgePlatform);
}
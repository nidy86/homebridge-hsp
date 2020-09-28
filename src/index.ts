import { API } from 'homebridge';

import { PLUGIN_NAME,PLATFORM_NAME } from './settings';
import { HspPlatform } from './platform'; 

export = (api: API) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, HspPlatform);
}
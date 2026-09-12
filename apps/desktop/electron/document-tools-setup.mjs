import {prepareHostPlugin,HOST_PLUGINS} from './host-plugin-setup.mjs';

/** Fixed host-owned plugin; never accepts a renderer path or arbitrary plugin id. */
export function prepareDocumentTools({directory,configPath,request,restart}) {
 return prepareHostPlugin({...HOST_PLUGINS.find(p=>p.id==='aifb-documents'),directory,configPath,request,restart});
}

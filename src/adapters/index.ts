import { registry } from '../core/registry';
import { metaAdapter } from './meta';
import { evolutionAdapter } from './evolution';
import { zapiAdapter } from './zapi';

registry.register(metaAdapter);
registry.register(evolutionAdapter);
registry.register(zapiAdapter);

export { registry };

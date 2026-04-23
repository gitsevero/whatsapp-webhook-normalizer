import { registry } from '../core/registry';
import { metaAdapter } from './meta';
import { evolutionAdapter } from './evolution';
import { zapiAdapter } from './zapi';
import { fakeAdapter } from './fake';

registry.register(metaAdapter);
registry.register(evolutionAdapter);
registry.register(zapiAdapter);
registry.register(fakeAdapter);

export { registry };

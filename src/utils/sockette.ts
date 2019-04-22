import * as ws from 'ws'
;(global as any).WebSocket = ws

import ISockette from 'sockette'
export default require('sockette') as typeof ISockette

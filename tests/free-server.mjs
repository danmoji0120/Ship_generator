import {createServer} from 'vite';
const server=await createServer({server:{port:5195,hmr:false}});await server.listen();server.printUrls();

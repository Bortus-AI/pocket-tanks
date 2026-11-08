import { getOnlineSessionId, installOnlineSession } from './session';
import io from 'socket.io-client'

const configuredUrl = process.env.REACT_APP_SOCKET_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : window.location.origin)
const url = configuredUrl.startsWith('http') ? configuredUrl : `https://${configuredUrl}`

export const socket = io(url, {auth: {sessionId: getOnlineSessionId()}, reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 3000})
installOnlineSession(socket)

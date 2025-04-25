// export function getLocalIP() {
//     return new Promise((resolve) => {
//       window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
//       const pc = new RTCPeerConnection({iceServers:[]});
//       pc.createDataChannel('');
//       pc.createOffer().then(pc.setLocalDescription.bind(pc));
//       pc.onicecandidate = (ice) => {
//         if (ice && ice.candidate && ice.candidate.candidate) {
//           const myIP = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(ice.candidate.candidate)[1];
//           resolve(myIP);
//           pc.onicecandidate = () => {};
//         }
//       };
//     });
//   }
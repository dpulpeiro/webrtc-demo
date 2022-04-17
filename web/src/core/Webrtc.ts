import io from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import {Consumer} from "mediasoup-client/lib/Consumer";
import {Transport} from "mediasoup-client/lib/Transport";

const PARAMS = {
    // mediasoup params
    encodings: [
        {
            rid: 'r0',
            maxBitrate: 100000,
            scalabilityMode: 'S1T3',
        },
        {
            rid: 'r1',
            maxBitrate: 300000,
            scalabilityMode: 'S1T3',
        },
        {
            rid: 'r2',
            maxBitrate: 900000,
            scalabilityMode: 'S1T3',
        },
    ],
    // https://mediasoup.org/documentation/v3/mediasoup-client/api/#ProducerCodecOptions
    codecOptions: {
        videoGoogleStartBitrate: 1000
    }
}

export class Webrtc {
    private socket: any;
    private device: any=null;
    private streamSuccessCallback: (stream: MediaStream) => void;
    private addRemoteVideoCallback: (remoteProducerId: string, params: any, consumer: Consumer) => void;
    private removeRemoteVideoCallback: (remoteProducerId: string) => void;
    private roomName: string;
    private rtpCapabilities: null | undefined;
    private consumerTransports: any[]=[];
    private producerTransport:Transport|null= null;
    private audioProducer:any=null;
    private videoProducer:any= null;
    private audioParams:any= null;
    private videoParams:any={PARAMS};
    private consumingTransports: any[]=[];
    private captureStream:any;
    constructor(socketURI:string="ws://127.0.0.1:3000/mediasoup",
                roomName:string,
                captureStream:MediaStream,
                streamSuccessCallback:(stream:MediaStream)=>void,
                addRemoteVideoCallback:(remoteProducerId:string,params:any,consumer:Consumer)=>void,
                removeRemoteVideoCallback:(remoteProducerId:string)=>void,

    ) {
        this.socket=io(socketURI)
        this.streamSuccessCallback=streamSuccessCallback;
        this.addRemoteVideoCallback=addRemoteVideoCallback;
        this.removeRemoteVideoCallback=removeRemoteVideoCallback;
        this.roomName=roomName;
        this.captureStream=captureStream;


    }
    setCaptureStream(captureStream:MediaStream){
        this.captureStream=captureStream;
    }
    setupSocket(){
        this.socket.on('connection-success', ({ socketId }:any) => {
            this.getLocalStream()
        })
        this.socket.on('new-producer', ({ producerId }:any) => this.signalNewConsumerTransport(producerId))
        this.socket.on('producer-closed', ({ remoteProducerId }:any) => {
            const producerToClose = this.consumerTransports.find(transportData => transportData.producerId === remoteProducerId)
            producerToClose.consumerTransport.close()
            producerToClose.consumer.close()
            this.consumerTransports = this.consumerTransports.filter(transportData => transportData.producerId !== remoteProducerId)
            this.removeRemoteVideoCallback(remoteProducerId)
        })

    }
    getLocalStream = () => {
        navigator.mediaDevices.getUserMedia({
            audio: true,
            video: {
                width: {
                    min: 640,
                    max: 1920,
                },
                height: {
                    min: 400,
                    max: 1080,
                }
            }
        })
            .then(this.streamSuccess)
            .catch(error => {
                console.log(error.message)
            })
    }
    streamSuccess =async (stream:MediaStream) => {
        this.streamSuccessCallback(stream);

        this.audioParams = { track: stream.getAudioTracks()[0], ...this.audioParams };
        this.videoParams = { track: this.captureStream.getVideoTracks()[0], ...this.videoParams };
        this.joinRoom()
    }
    joinRoom = () => {
        const roomName=this.roomName
        this.socket.emit('joinRoom', { roomName }, (data:any) => {
            console.log(`Router RTP Capabilities... ${data.rtpCapabilities}`)
            this.rtpCapabilities = data.rtpCapabilities
            this.createDevice()
        })
    }
    createDevice = async () => {
        try {
            this.device = new mediasoupClient.Device()
            await this.device.load({
                routerRtpCapabilities: this.rtpCapabilities
            })

            console.log('Device RTP Capabilities', this.device.rtpCapabilities)
            this.createSendTransport()
        } catch (error:any) {
            if (error.name === 'UnsupportedError')
                console.warn('browser not supported')
        }
    }
    createSendTransport = () => {
        this.socket.emit('createWebRtcTransport', { consumer: false }, ({ params }:any) => {
            if (params.error) {
                console.log(params.error)
                return
            }
            this.producerTransport = this.device.createSendTransport(params)
            if (!this.producerTransport) return;
            this.producerTransport.on('connect', async ({ dtlsParameters }:any, callback:any, errback:any) => {
                try {
                    await this.socket.emit('transport-connect', {
                        dtlsParameters,
                    })
                    callback()
                } catch (error) {
                    errback(error)
                }
            })

            this.producerTransport.on('produce', async (parameters:any, callback:any, errback:any) => {
                console.log(parameters)

                try {
                    await this.socket.emit('transport-produce', {
                        kind: parameters.kind,
                        rtpParameters: parameters.rtpParameters,
                        appData: parameters.appData,
                    }, ({ id, producersExist }:any) => {
                        callback({ id })
                        if (producersExist) this.getProducers()
                    })
                } catch (error) {
                    errback(error)
                }
            })
            this.connectSendTransport()
        })

    }
    connectSendTransport = async () => {
        if (!this.producerTransport) return;
        this.audioProducer = await this.producerTransport.produce(this.audioParams);
        this.videoProducer = await this.producerTransport.produce(this.videoParams);
        this.audioProducer.on('trackended', () => {
            console.log('audio track ended')
        })
        this.audioProducer.on('transportclose', () => {
            console.log('audio transport ended')
        })
        this.videoProducer.on('trackended', () => {
            console.log('video track ended')
        })
        this.videoProducer.on('transportclose', () => {
            console.log('video transport ended')
        })

    }
    getProducers = () => {
        this.socket.emit('getProducers', (producerIds:string[]) => {
            console.log(producerIds)
            producerIds.forEach(this.signalNewConsumerTransport)
        })
    }
    signalNewConsumerTransport = async (remoteProducerId:string) => {
        if (this.consumingTransports.includes(remoteProducerId)) return;
        this.consumingTransports.push(remoteProducerId);

        await this.socket.emit('createWebRtcTransport', { consumer: true }, ({ params }:any) => {
            if (params.error) {
                console.log(params.error)
                return
            }
            console.log(`PARAMS... ${params}`)
            let consumerTransport:Transport
            try {
                consumerTransport = this.device.createRecvTransport(params)
            } catch (error) {
                console.log(error)
                return
            }

            consumerTransport.on('connect', async ({ dtlsParameters }:any, callback:any, errback:any) => {
                try {
                    await this.socket.emit('transport-recv-connect', {
                        dtlsParameters,
                        serverConsumerTransportId: params.id,
                    })

                    callback()
                } catch (error) {
                    errback(error)
                }
            })

            this.connectRecvTransport(consumerTransport, remoteProducerId, params.id)
        })
    }
    connectRecvTransport = async (consumerTransport:Transport, remoteProducerId:string, serverConsumerTransportId:string) => {
        await this.socket.emit('consume', {
            rtpCapabilities: this.device.rtpCapabilities,
            remoteProducerId,
            serverConsumerTransportId,
        }, async ({ params }:any) => {
            if (params.error) {
                console.log('Cannot Consume')
                return
            }

            console.log(`Consumer Params ${params}`)
            const consumer = await consumerTransport.consume({
                id: params.id,
                producerId: params.producerId,
                kind: params.kind,
                rtpParameters: params.rtpParameters
            })

            this.consumerTransports = [
                ...this.consumerTransports,
                {
                    consumerTransport,
                    serverConsumerTransportId: params.id,
                    producerId: remoteProducerId,
                    consumer,
                },
            ]
            this.addRemoteVideoCallback(remoteProducerId,params,consumer)
            this.socket.emit('consumer-resume', { serverConsumerId: params.serverConsumerId })
        })
    }

}

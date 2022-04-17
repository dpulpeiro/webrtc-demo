import React, {createRef, useEffect} from 'react';
import {toSquare} from "./core/utils";
import {useParams} from "react-router-dom";
import '@tensorflow/tfjs-backend-webgl';

import {FaceSmoother} from "./core/faceSmoother";
import * as blazeface from "@tensorflow-models/blazeface";
import {BlazeFaceModel} from "@tensorflow-models/blazeface/dist/face";
import {Consumer} from "mediasoup-client/lib/Consumer";
import {Webrtc} from "./core/Webrtc";

function ChatRoom() {

  const {roomName} = useParams()
  const localVideo=createRef<HTMLVideoElement>();
  const localCanvas=createRef<HTMLCanvasElement>();
  const videoContainer=createRef<HTMLDivElement>();
  const faceSmoother = new FaceSmoother(30);
  let webrtc:Webrtc;
  async function cropFaceArea(faceDetector:BlazeFaceModel,video:HTMLVideoElement,context:CanvasRenderingContext2D) {
    const faces = await faceDetector.estimateFaces(video);
    if (faces.length>0){
      let face= faceSmoother.smooth(faces[0])
      const [left,top,width,height]=toSquare(face.topLeft,face.bottomRight,video.videoWidth, video.videoHeight)
      context.drawImage(video, left,top,width,height,0, 0, context.canvas.width, context.canvas.height);
      // Imagefilters.Oil(context.getImageData(0, 0, canvas.width, canvas.height))
    }
  }
  const streamSuccessCallback =async (stream:MediaStream) => {
    // @ts-ignore
    localVideo.current.srcObject = stream
    // @ts-ignore
    const context = localCanvas.current.getContext('2d')
    const model = await blazeface.load();
    await (async function renderLoop() {
      requestAnimationFrame(renderLoop);
      await cropFaceArea(model, localVideo.current as HTMLVideoElement, context as CanvasRenderingContext2D);
    })();
  }
  const removeRemoteVideoCallback=(remoteProducerId:string)=>{
    // @ts-ignore
    videoContainer.current.removeChild(document.getElementById(`td-${remoteProducerId}`))
  }

  const addRemoteVideoCallback=(remoteProducerId:string,params:any,consumer:Consumer) => {
    const newElem = document.createElement('div')
    newElem.setAttribute('id', `td-${remoteProducerId}`)
    if (params.kind === 'audio') {
      newElem.innerHTML = '<audio id="' + remoteProducerId + '" autoplay></audio>'
    } else {
      newElem.setAttribute('class', 'rounded-full overflow-hidden w-[400px] h-[400px]')
      newElem.innerHTML = '<video id="' + remoteProducerId + '" autoplay class="video" />'
    }
    // @ts-ignore
    videoContainer.current.appendChild(newElem)
    const { track } = consumer
    // @ts-ignore
    document.getElementById(remoteProducerId).srcObject = new MediaStream([track])
  }

  useEffect(()=>{
    if (!roomName||!localCanvas.current)return;
    const canvasStream: MediaStream= localCanvas.current.captureStream(30)
    webrtc=new Webrtc(
        "wss://mediasoup.dpulpeiro.xyz/mediasoup",
        roomName,
        canvasStream,
        streamSuccessCallback,
        addRemoteVideoCallback,
        removeRemoteVideoCallback
    )
    webrtc.setupSocket()

  },[])
  return (
      <div>
        <div>
              <canvas ref={localCanvas} width={400} height={400} className="rounded-full"/>
              <video id="video" ref={localVideo} autoPlay className="absolute opacity-0" muted  />
        </div>
        <div className="flex flex-row" ref={videoContainer}/>

      </div>
  );
}

export default ChatRoom;

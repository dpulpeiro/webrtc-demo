export const toSquare = (leftTop:number[],rightBottom:number[],videoWidth:number,videoHeight:number) :number[]=> {
    const [left,top,] = leftTop;
    const [right,bottom] = rightBottom;
    let size = right-left;
    if (2*size>videoWidth){size=videoWidth/2}
    if (2*size>videoHeight){size=videoHeight/2}

    const centerX = (left+right) / 2;
    const centerY = top+0.3*(bottom-top);
    let leftX=centerX-size;
    let topY=centerY-size;

    if (leftX<0)leftX=0;
    if (topY<0)topY=0;
    if (leftX+2*size>videoWidth){leftX=videoWidth-2*size}
    if (topY+2*size>videoHeight){topY=videoHeight-2*size}
    return [leftX,topY,2*size,2*size]
}
export const addCanvas=(width:number, height:number,element="root",display='none') =>{
    const canvas = document.createElement('canvas');
    canvas.id="localVideo";
    canvas.setAttribute('width', width.toString());
    canvas.setAttribute('height', height.toString());
    const htmlElement: HTMLElement|null= document.getElementById(element)
    if (htmlElement !== null){
        htmlElement.appendChild(canvas);
    }
    return canvas;
}
export const calculateAverage=(array:number[])=> {
    let total = 0;
    let count = 0;
    array.forEach(function(item, index) {
        total += item;
        count++;
    });
    return total / count;
}

import {calculateAverage} from "./utils";
import {Tensor1D} from "@tensorflow/tfjs-core";

export class FaceSmoother {
    private readonly size: number;
    private top: number[]=[];
    private left: number[]=[];
    private right: number[]=[];
    private bottom: number[]=[];

    constructor(size:number) {
        this.size = size;
    }
    smooth(face:{topLeft:[number, number] | Tensor1D,bottomRight:[number, number] | Tensor1D}){
        const [top,left] = face.topLeft as [number,number];
        const [bottom,right] = face.bottomRight as [number,number];
        this.left.push(left);
        this.top.push(top);
        this.right.push(right);
        this.bottom.push(bottom);

        if (this.left.length>this.size){this.left.shift()}
        if (this.top.length>this.size){this.top.shift()}
        if (this.right.length>this.size){this.right.shift()}
        if (this.bottom.length>this.size){this.bottom.shift()}
        return {
            "topLeft":[calculateAverage(this.top),calculateAverage(this.left)],
            "bottomRight":[calculateAverage(this.bottom),calculateAverage(this.right)]
        }
    }

}

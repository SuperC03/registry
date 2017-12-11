import { $, arange, backend, fill, grad, linspace, multigrad, ones, randn,
  tanh, zeros } from "./api";
import { assert, assertAllClose, assertAllEqual, assertClose,
  assertShapesEqual } from "./util";

function checkGrad(f, g, val = 1.0) {
  const epsilon = 0.01;
  const a = $(f(val + epsilon));
  const b = $(f(val - epsilon));
  const expected = a.sub(b).div(2 * epsilon);
  const actual = g(val);
  assertClose(actual, expected);
}

// Basic Tests

function testLinspace() {
  const x = linspace(-4, 4, 6);
  assertAllClose(x, [-4., -2.4, -0.8,  0.8,  2.4, 4.]);
}

function testArange() {
  const r1 = arange(-2, 2);
  assertAllEqual(r1, [-2, -1, 0, 1]);
  const r2 = arange(4);
  assertAllEqual(r2, [0, 1, 2, 3]);
  const r3 = arange(4, 10, 2);
  assertAllEqual(r3, [4, 6, 8]);
}

function testRandn() {
  const t = randn(2, 3);
  assertAllEqual(t.shape, [2, 3]);
  const d = t.getData();
  console.log("randn", d);
  // TODO this isn't the best test...
  assert(d[0] !== d[1]);
  assert(d[1] !== d[2]);
}

function testConvertWithType() {
  const t = $([1, 2, 3], "int32");
  assert(t.dtype === "int32");
  const ta = t.getData();
  assert(ta instanceof Int32Array);

  const ta2 = new Int32Array([1, 2, 3]);
  const t2 = $(ta2);
  assert(t2.dtype === "int32");
  assert(t2.getData() instanceof Int32Array);
}

// Backprop Tests

function testInc() {
  function f(x) {
    return $(x).add(1);
  }
  assertClose(f(1), 2);
  assertClose(f(-1), 0);
  const g = grad(f);
  assertClose(g(1.0), 1.);
  checkGrad(f, g, 1.0);
}

function testMul() {
  const f = (x) => $(42).mul(x);
  assertClose(f(1), 42);
  assertClose(f(2), 84);
  const g = grad(f);
  assertClose(g(1.), 42.);
  checkGrad(f, g, 1.0);
}

function testSquared() {
  // f(x) = x^2
  function f(x) {
    return $(x).mul(x);
  }
  assertClose(f(1), 1);
  assertClose(f(16), 256);
  const g = grad(f); // g(x) = f'(x) = 2x
  assertClose(g(1), 2);
  assertClose(g(10), 20);
  checkGrad(f, g, 1.0);
}

function testSquaredMatrix() {
  // f(x) = x^2
  function f(x) {
    return $(x).mul(x);
  }
  assertAllEqual(f([[1, 2], [3, 4]]), [[1, 4], [9, 16]]);
  const g = grad(f); // g(x) = f'(x) = 2x
  const v = g([[1, 2], [3, 4]]);
  assertAllEqual(v.shape, [2, 2]);
  assertAllEqual(v, [[2, 4], [6, 8]]);
}

function testDiv() {
  // f(x) = (1 + x) / x
  function f(x) {
    x = $(x);
    return x.add(1).div(x);
  }
  assertClose(f(1), 2);
  assertClose(f(16), (1 + 16) / 16);
  const g = grad(f); // g(x) = -1 / x^2
  assertClose(g(1), -1);
  assertClose(g(10), -1 / 100);
  checkGrad(f, g, 1.0);
}

function testConstant() {
  const f = (_) => 42;
  assertClose(f(1), 42);
  assertClose(f(-1), 42);
  const g = grad(f);
  assertClose(g(1.0), 0.);
  checkGrad(f, g, 1.0);
}

function testExp() {
  // f(x) = exp(1+x)
  function f(x) {
    return $(x).add(1).exp();
  }
  assertClose(f(1), 7.3890);
  assertClose(f(2), 20.0855);
  const g = grad(f); // g == f
  assertClose(g(1), 7.3890);
  assertClose(g(2), 20.0855);
  checkGrad(f, g, 1.0);
}

function testLog() {
  // f(x) = log(x)/log(base)
  function f(x, base) {
    return $(x).log().div($(base).log());
  }
  assertClose(f(2, 2), 1);
  assertClose(f(9, 3), 2);
  assertClose(f(64, 4), 3);
  assertClose(f(625, 5), 4);
  const g = grad(f); // g = (x*Math.log(base))^-1
  assertClose(g(2, 2), 1 / (2 * Math.log(2)));
  assertClose(g(9, 3), 1 / (9 * Math.log(3)));
  assertClose(g(64, 4), 1 / (64 * Math.log(4)));
  assertClose(g(625, 5), 1 / (625 * Math.log(5)));
}

function testSub() {
  function f(x) {
    return $(1).sub(x);
  }
  assertClose(f(1), 0);
  assertClose(f(2), -1);
  const g = grad(f);
  assertClose(g(1), -1);
  assertClose(g(2), -1);
  checkGrad(f, g, 1.0);
}

function testDiv2() {
  function f(x) {
    x = $(x);
    return $(1).sub(x).div(x.add(1));
  }
  assertClose(f(1), 0);
  assertClose(f(2), -1 / 3);
  const g = grad(f); // g(x) = -2 / (x + 1)^2
  assertClose(g(1), -2 / 4);
  assertClose(g(2), -2 / 9);
  checkGrad(f, g, 1.0);
}

function testDiv3() {
  function f(x) {
    const y = $(x).exp();
    return y.div(y);
  }
  assertClose(f(1), 1.);
  assertClose(f(2), 1.);
  const g = grad(f);
  assertClose(g(1), 0.);
  assertClose(g(2), 0.);
  checkGrad(f, g, 1.0);
}

function testTanh() {
  const f = tanh;
  assertClose(f(1), 0.7615);
  assertClose(f(16), 0.9999);
  const g = grad(f);
  assertClose(g(1), 0.4199);
  checkGrad(f, g, 1.0);
}

function testMultigrad() {
  function f(a, b) {
    return $(a).mul(2).add($(b).mul(3));
  }
  assertClose(f(1, 1), 5);
  assertClose(f(1, 2), 8);
  const g = multigrad(f, [0, 1]);
  assertClose(g(1, 1)[0], 2);
  assertClose(g(1, 1)[1], 3);
  assertClose(g(4, 2)[0], 2);
  assertClose(g(4, 2)[1], 3);
}

function testGradGradTanh() {
  const f = tanh;
  assertAllClose(f([1, 16]), [0.7615, 0.9999]);
  const g = grad(grad(f));
  // def g(x): return -2 * np.tanh(x) / np.square(np.cosh(x))
  assertAllClose(g([1, 2]), [-0.6397, -0.13621]);
}

function testSinh() {
  const f = (x) => $(x).sinh();
  const v = $([1, 2]);
  assertAllClose(f(v), [1.17520119,  3.62686041]);
  // The derivtive of sinh is cosh.
  const g = grad(f);
  assertAllClose(g(v), v.cosh());
}

function testFill() {
  const f = (x) => fill(x, [2, 3]);
  assertAllEqual(f(1), [[1, 1, 1], [1, 1, 1]]);
  assertAllEqual(f(42), [[42, 42, 42], [42, 42, 42]]);
  // TODO
  // const g = grad(f);
  // assertAllEqual(g(1), [1]);
}

function testSquare() {
  const f = (x) => $(x).square();
  const v = $([2, 4, -1]);
  assertAllClose(f(v), [4, 16, 1]);
  // The derivtive of x^2 is 2x
  const g = grad(f);
  assertAllClose(g(v), [4, 8, -2]);
}

function testTranspose() {
  const f = (x) => $(x).transpose();
  const a = $([[1, 2], [3, 4]]);
  const aT = $([[1, 3], [2, 4]]);
  assertAllEqual(f(a), aT);
  const g = grad(f);
  assertAllEqual(g(a), [[1, 1], [1, 1]]);

  const f2 = (x) => $(x).transpose().mul(2);
  const g2 = grad(f2);
  assertAllEqual(g2(a), [[2, 2], [2, 2]]);
}

function testReverse() {
  assertAllEqual($([1, 2, 3, 4]).reverse(), [4, 3, 2, 1]);

  const t = $([[[[ 0,  1,  2,  3],
                 [ 4,  5,  6,  7],
                 [ 8,  9, 10, 11]],
                [[12, 13, 14, 15],
                 [16, 17, 18, 19],
                 [20, 21, 22, 23]]]]);
  assertAllEqual(t.shape, [1, 2, 3, 4]);
  const tR1 = $([[[[12, 13, 14, 15],
                   [16, 17, 18, 19],
                   [20, 21, 22, 23]],
                  [[ 0,  1,  2,  3],
                   [ 4,  5,  6,  7],
                   [ 8,  9, 10, 11]]]]);
  assertAllEqual(t.reverse([1]), tR1);
  assertAllEqual(t.reverse([-3]), tR1);
  const tR2 = $([[[[8, 9, 10, 11],
                   [4, 5, 6, 7],
                   [0, 1, 2, 3]],
                  [[20, 21, 22, 23],
                   [16, 17, 18, 19],
                   [12, 13, 14, 15]]]]);
  assertAllEqual(t.reverse([2]), tR2);
  assertAllEqual(t.reverse([-2]), tR2);
  const tR3 = $([[[[ 3,  2,  1,  0],
                   [ 7,  6,  5,  4],
                   [ 11, 10, 9, 8]],
                  [[15, 14, 13, 12],
                   [19, 18, 17, 16],
                   [23, 22, 21, 20]]]]);
  assertAllEqual(t.reverse([3]), tR3);
  assertAllEqual(t.reverse([-1]), tR3);

  const f = (x) => $(x).reverse().mul(2);
  const g = grad(f);
  assertAllEqual(g([1, 2, 3]), [2, 2, 2]);
}

function testMatMul() {
  function f(x, y) {
    return $(x).matmul(y);
  }
  const a = $([
    [9, 8, 7],
    [6, 5, 4],
  ]);
  const b = $([
    [1, 2],
    [4, 5],
    [7, 8],
  ]);
  const r = f(a, b);
  assertShapesEqual(r.shape, [2, 2]);
  assertAllClose(r, [
    [90, 114],
    [54, 69],
  ]);
  // Now test gradients
  const g = multigrad(f, [0, 1]);
  const gab = g(a, b);
  assertAllEqual(gab[0], [
    [3, 9, 15],
    [3, 9, 15],
  ]);
  assertAllEqual(gab[1], [
    [15, 15],
    [13, 13],
    [11, 11],
  ]);
}

function testReduceSum() {
  const a = $([
    [9, 8, 7],
    [6, 5, 4],
  ]);
  assertAllEqual(a.reduceSum([0]), [9 + 6, 8 + 5, 7 + 4]);
  assertAllEqual(a.reduceSum([1]), [9 + 8 + 7, 6 + 5 + 4]);
  assertAllEqual(a.reduceSum(), 9 + 8 + 7 + 6 + 5 + 4);

  assertAllEqual(a.reduceSum([0], true), [[9 + 6, 8 + 5, 7 + 4]]);
  assertAllEqual(a.reduceSum([1], true), [[9 + 8 + 7], [6 + 5 + 4]]);

  const f = (x) => $(x).mul(2).reduceSum([0]);
  const g = grad(f);
  assertAllEqual(g(a), [[2, 2, 2], [2, 2, 2]]);
}

function testReduceMax() {
  const a = $([
    [9, 5, 7],
    [6, 8, 4],
  ]);
  assertAllEqual(a.reduceMax([0]), [9, 8, 7]);
  assertAllEqual(a.reduceMax([1]), [9, 8]);
  assertAllEqual(a.reduceMax(), 9);
  assertAllEqual(a.reduceMax([0], true), [[9, 8, 7]]);
  assertAllEqual(a.reduceMax([1], true), [[9], [8]]);

  /* TODO
  const f = (x) => $(x).reduceMax([0])
  const g = grad(f);
  assertAllEqual(g(a), [[1, 0, 1], [0, 1, 0]]);
  */
}

function testOnesAndZerosLike() {
  const a = $([
    [9, 5, 7],
    [6, 8, 4],
  ]);
  assertAllEqual(a.onesLike(), [ [1, 1, 1], [1, 1, 1] ]);
  assertAllEqual(a.zerosLike(), [ [0, 0, 0], [0, 0, 0] ]);
}

function testEqual() {
  const a = $([
    [9, 5, 7],
    [6, 8, 4],
  ]);
  const b = $([
    [9, 3, 7],
    [0, 8, 2],
  ]);
  const r = a.equal(b);
  assert(r.dtype === "bool");
  // TODO Allow assertAllEqual to handle boolean.
  assertAllEqual(r, [ [1, 0, 1], [0, 1, 0] ]);

  // equal isn't differentiable but it should have the same behavior as
  // autograd does.
  const f = (x, y) => $(x).equal(y);
  const g = multigrad(f, [0, 1]);
  assertAllEqual(g(a, b)[0], [ [0, 0, 0], [0, 0, 0] ]);
  assertAllEqual(g(a, b)[1], [ [0, 0, 0], [0, 0, 0] ]);
}

function testReshape() {
  const a = $([
    [9, 5, 7],
    [6, 8, 4],
  ]);
  assertAllEqual(a.reshape([3, 2]), [
    [9, 5],
    [7, 6],
    [8, 4],
  ]);
  const f = (x) => $(x).reshape([3, 2]);
  const g = grad(f);
  assertAllEqual(g(a), [
    [1, 1, 1],
    [1, 1, 1],
  ]);
}

function testFlatten() {
  const a = $([[1, 2], [3, 4]]);
  assertAllEqual(a.flatten(), [1, 2, 3, 4]);
}

function testSqueeze() {
  const a = $([[[0], [1], [2]]]);
  assertShapesEqual(a.shape, [1, 3, 1]);
  const b = a.squeeze();
  assertAllEqual(b, [0, 1, 2]);
  const c = $([[1, 2], [3, 4]]);
  assertAllEqual(c.squeeze(), c);
}

function testReduceLogSumExp() {
  assertClose($([1, 2, 3, 4]).reduceLogSumExp(), 4.44018969856);
  const f = (x) => $(x).reduceLogSumExp();
  const g = grad(f);
  assertAllClose(g([2, 3]), [0.26894142, 0.73105858]);
}

function testSoftmax() {
  const f = (x) => $(x).softmax();
  assertAllClose(f([1, 2, 3, 4]),
    [0.0320586, 0.08714432, 0.23688281, 0.64391422]);
  // Derivative of softmax isn't numerically stable.
  const g = grad(f);
  assertAllClose(g([1, 2, 3, 4]), [0, 0, 0, 0]);
}

function testLogSoftmax() {
  const f = (x) => $(x).logSoftmax();
  assertAllClose(f([1, 2, 3, 4]),
    [-3.44018984, -2.44018984, -1.44018972, -0.44018975]);
  const g = grad(f);
  assertAllClose(g([1, 2, 3, 4]),
    [0.87176559, 0.65142273, 0.05246873, -1.57565704]);
}

function testArgMaxAndMin() {
  const a = $([
    [9, 5, 7],
    [6, 8, 4],
  ]);
  assertAllEqual(a.argmax(1), [0, 1]);
  assertAllEqual(a.argmin(1), [1, 2]);
  assertAllEqual(a.argmax(0), [0, 1, 0]);
  assertAllEqual(a.argmin(0), [1, 0, 1]);
  // Not differentiable.
  const g = grad((x) => $(x).argmax(0));
  assertAllEqual(g(a), [
    [0, 0, 0],
    [0, 0, 0],
  ]);
  const h = grad((x) => $(x).argmin(0));
  assertAllEqual(h(a), [
    [0, 0, 0],
    [0, 0, 0],
  ]);
}

function testDot() {
  assertAllEqual($(3).dot(4), 12);
  assertAllEqual($([[3]]).dot([[4]]), [[12]]);
  const r = $([9, 5, 7]).dot([6, 8, 4]);
  assertAllEqual(r, 122);
  const m1 = $([
    [9, 8, 7],
    [6, 5, 4],
  ]);
  const m2 = $([
    [1, 2],
    [4, 5],
    [7, 8],
  ]);
  assertAllEqual(m1.dot(m2), [[90, 114], [54, 69]]);
  assertAllEqual(m1.dot([1, 2, 3]), [46, 28]);
  assertAllEqual($([1, 2, 3]).dot(m2), [30, 36]);
}

function testZerosOnes() {
  const z1 = zeros([2, 3]);
  assertAllEqual(z1, [[0, 0, 0], [0, 0, 0]]);
  assert(z1.dtype === "float32");

  const z2 = zeros([2, 3], "int32");
  assertAllEqual(z2, [[0, 0, 0], [0, 0, 0]]);
  assert(z2.dtype === "int32");

  const o1 = ones([2, 3]);
  assertAllEqual(o1, [[1, 1, 1], [1, 1, 1]]);
  assert(o1.dtype === "float32");

  const o2 = ones([2, 3], "int32");
  assertAllEqual(o2, [[1, 1, 1], [1, 1, 1]]);
  assert(o2.dtype === "int32");
}

testLinspace();
testArange();
testRandn();
testConvertWithType();

testInc();
testMul();
testSquared();
testDiv();
testConstant();
testExp();
testLog();
testSub();
testDiv2();
testDiv3();
testTanh();
testMultigrad();
testSquaredMatrix();
testGradGradTanh();
testSinh();
testFill();
testSquare();
testTranspose();
testReverse();
testMatMul();
testReduceSum();
testReduceMax();
testOnesAndZerosLike();
testEqual();
testReshape();
testFlatten();
testSqueeze();
testReduceLogSumExp();
testSoftmax();
testLogSoftmax();
testArgMaxAndMin();
testDot();
testZerosOnes();
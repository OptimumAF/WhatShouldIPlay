import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { pickSpinWithWeights } from "../../src/lib/wheel";

const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;
const indexAtTopPointer = (count: number, rotation: number) =>
  Math.floor(normalizeAngle(-rotation) / (360 / count));

const recordedFailure = JSON.parse(
  readFileSync(new URL("../fixtures/selection-edge-cases.json", import.meta.url), "utf8"),
) as {
  recordedWheelFailure: {
    sectorCount: number;
    startRotation: number;
    winnerIndex: number;
    revolutions: number;
    jitterRatio: number;
    jitterRandom: number;
  };
};

const pickWithRandom = (
  count: number,
  currentRotation: number,
  winnerIndex: number,
  revolutions: number,
  jitterRatio: number,
  jitterRandom: number,
) => {
  const values = [(winnerIndex + 0.5) / count, jitterRandom];
  return pickSpinWithWeights(
    count,
    currentRotation,
    undefined,
    { revolutions, jitterRatio },
    () => values.shift() ?? 0.5,
  );
};

test("the top pointer lands on the chosen sector from a nonzero starting angle", () => {
  const fixture = recordedFailure.recordedWheelFailure;
  const result = pickWithRandom(
    fixture.sectorCount,
    fixture.startRotation,
    fixture.winnerIndex,
    fixture.revolutions,
    fixture.jitterRatio,
    fixture.jitterRandom,
  );
  assert.equal(result.winnerIndex, fixture.winnerIndex);
  assert.equal(indexAtTopPointer(fixture.sectorCount, result.nextRotation), result.winnerIndex);
});

test("all motion profiles and bounded jitter land after repeated spins", () => {
  for (const count of [1, 2, 3, 4, 5, 10, 37]) {
    for (const revolutions of [10.5, 8, 6.4, 2.2]) {
      for (const jitterRandom of [0, 0.5, 0.999]) {
        let rotation = 90;
        for (let winnerIndex = 0; winnerIndex < count; winnerIndex += 1) {
          const result = pickWithRandom(count, rotation, winnerIndex, revolutions, 0.28, jitterRandom);
          assert.equal(result.winnerIndex, winnerIndex);
          assert.equal(
            indexAtTopPointer(count, result.nextRotation),
            winnerIndex,
            `count=${count}, turns=${revolutions}, jitter=${jitterRandom}, from=${rotation}`,
          );
          rotation = result.nextRotation;
        }
      }
    }
  }
});

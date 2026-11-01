import { expect } from "chai";
import { VexFlowVibratoBracket } from "../../../../src/MusicalScore/Graphical/VexFlow/VexFlowVibratoBracket";

describe("Vibrato main-note anchors at grace boundaries", () => {
    for (const method of ["setStartNote", "setEndNote"]) {
        for (const mainPresent of [true, false]) {
            it(`${method} ${mainPresent ? "prefers the formatted main note" : "retains a grace-only fallback"}`, () => {
                const staffEntry: any = {graphicalVoiceEntries: [], parentMeasure: {staffEntries: []}};
                staffEntry.parentMeasure.staffEntries.push(staffEntry);
                const grace: any = {parentVoiceEntry: {IsGrace: true}, vfStaveNote: {}, parentStaffEntry: staffEntry};
                const main: any = {parentVoiceEntry: {IsGrace: false}, vfStaveNote: {}, parentStaffEntry: staffEntry};
                staffEntry.graphicalVoiceEntries = mainPresent ? [grace, main] : [grace];
                const bracket: any = Object.create(VexFlowVibratoBracket.prototype);
                expect(bracket[method](staffEntry)).to.equal(true);
                const expected: any = mainPresent ? main : grace;
                expect(bracket[method === "setStartNote" ? "startNote" : "endNote"]).to.equal(expected.vfStaveNote);
                expect(bracket[method === "setStartNote" ? "startVfVoiceEntry" : "endVfVoiceEntry"]).to.equal(expected);
            });
        }
    }
});

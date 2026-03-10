import * as Tone from "tone";
import type { InteractionState } from "@/features/inference/inference-types";

export class AudioEngine {
  private filter: Tone.Filter | null = null;
  private reverb: Tone.Reverb | null = null;
  private synth: Tone.MonoSynth | null = null;
  private shimmer: Tone.FeedbackDelay | null = null;
  private started = false;
  private noteActive = false;

  async start() {
    if (this.started) {
      return;
    }

    await Tone.start();

    this.reverb = new Tone.Reverb({
      decay: 6.2,
      wet: 0.2,
    }).toDestination();

    this.shimmer = new Tone.FeedbackDelay({
      delayTime: "8n",
      feedback: 0.18,
      wet: 0.12,
    }).connect(this.reverb);

    this.filter = new Tone.Filter({
      type: "lowpass",
      frequency: 520,
      rolloff: -24,
      Q: 0.4,
    }).connect(this.shimmer);

    this.synth = new Tone.MonoSynth({
      oscillator: {
        type: "sawtooth6",
      },
      envelope: {
        attack: 0.12,
        decay: 0.2,
        sustain: 0.8,
        release: 0.9,
      },
      filterEnvelope: {
        attack: 0.04,
        decay: 0.3,
        sustain: 0.4,
        release: 1.2,
        baseFrequency: 180,
        octaves: 2.6,
      },
      volume: -18,
    }).connect(this.filter);

    this.started = true;
  }

  update(interaction: InteractionState) {
    if (!this.started || !this.filter || !this.reverb || !this.synth) {
      return;
    }

    if (!interaction.handDetected) {
      if (this.noteActive) {
        this.synth.triggerRelease();
        this.noteActive = false;
      }
      return;
    }

    if (!this.noteActive) {
      this.synth.triggerAttack("C2");
      this.noteActive = true;
    }

    let cutoff = 260 + interaction.pinch * 4200;
    let detune = (interaction.pinch - 0.5) * 260;
    let wet = 0.18;
    let delayWet = 0.12;
    let volume = -18 + interaction.pinch * 10;
    let targetFrequency = Tone.Frequency("C2").toFrequency();

    if (interaction.sceneMode === "open-palm") {
      wet = 0.24;
      volume = -12;
      targetFrequency = Tone.Frequency("C2").toFrequency();
    } else if (interaction.sceneMode === "pinch-focus") {
      cutoff += 900;
      detune += 80;
      delayWet = 0.18;
      targetFrequency = Tone.Frequency("G2").toFrequency();
    } else if (interaction.sceneMode === "victory-flare") {
      wet = 0.48;
      delayWet = 0.24;
      volume = -10;
      detune += 140;
      targetFrequency = Tone.Frequency("E2").toFrequency();
    }

    this.filter.frequency.rampTo(cutoff, 0.08);
    this.reverb.wet.rampTo(wet, 0.12);
    this.shimmer?.wet.rampTo(delayWet, 0.12);
    this.synth.detune.rampTo(detune, 0.08);
    this.synth.volume.rampTo(volume, 0.08);
    this.synth.frequency.rampTo(targetFrequency, 0.12);
  }

  dispose() {
    if (this.noteActive) {
      this.synth?.triggerRelease();
      this.noteActive = false;
    }

    this.synth?.dispose();
    this.filter?.dispose();
    this.shimmer?.dispose();
    this.reverb?.dispose();

    this.synth = null;
    this.filter = null;
    this.shimmer = null;
    this.reverb = null;
    this.started = false;
  }
}

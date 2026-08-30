---
title: Instrument Studio
description: Choose a sound, play the piano, and record your first phrase.
order: 1
---

# Instrument Studio

Studio is the workspace for playing and shaping a piece. It saves changes to a
local library in your browser, so you can leave and continue later.

## Play the piano

Open [Studio](/studio) and select **Piano**.

1. Select a voice in the left browser. If the piece has no voices, select **Add
   voice**.
2. Choose a sound in the inspector.
3. Play the on-screen keys with a pointer or touch. On a computer keyboard, use
   **A–K** for white keys and **W**, **E**, **T**, **Y**, and **U** for black
   keys.
4. Use the octave control above the piano to reach a different register.

The piano plays the selected voice immediately. It does not start the piece
transport.

## Record a phrase

Select **Record phrase**, play the piano, then select **Stop recording**. Studio
creates a phrase from the notes you played and connects it to the selected
voice. The phrase display shows each pitch, onset, and duration.

Leave **Quantize to 1/16 notes** selected to move recorded notes to the nearest
sixteenth-note grid. Clear it to keep the performed timing. You can quantize a
phrase later from the phrase display or Materials view.

## Create a matrix pattern

Select **Matrix**, then add or select a matrix in the Materials list. Select a
cell to turn its pitch on or off for that step. The moving column marker follows
the transport playhead.

Use **Steps** to set the pattern length and **Subdivision** to set the duration
of each step. Edit a row's MIDI pitch directly, or add and remove pitch rows.
Matrix edits change canonical `StepPattern` material and become audible during
running playback.

To play a new matrix, select a voice and choose the matrix from its **Material**
control. Select **Play** in the transport.

## Work with voices and materials

A voice connects musical material to a sound. Select a voice to edit its name,
material, sound, gain, pan, reverb, filter cutoff, or playback state in the
inspector.

Material is the musical source. A phrase contains freely timed notes; a matrix
contains pitches arranged into steps. Use the Materials list to add, inspect, or
delete material. Before deleting material used by a voice, set that voice's
material to **No material**.

## Save and reopen a piece

Studio saves edits after a short pause. Select **Save** when you want immediate
confirmation. Your pieces remain in this browser's local library.

Use **Export** to keep an `.ambiente.json` copy outside the browser. Use
**Import** to add an exported piece to the local library. If the browser cannot
protect local storage from cleanup, Studio shows a reminder to export important
work.

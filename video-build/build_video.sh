#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
CARDS=video-build/cards
AUD=video-build/audio
SEG=video-build/segments
mkdir -p "$SEG"
rm -f $SEG/*.mp4 $SEG/*.mp3 $SEG/*.m4a 2>/dev/null || true
FPS=30
HEAD_MS=500      # narration starts 0.5s after the card appears
TAIL_S=0.75      # trailing pad after narration ends

names=(01_intro 02_paths 03_find 04_order 05_track 06_notify 07_staff 08_dispatch 09_fleet 10_reports 11_onboard 12_outro)

concat_v="$SEG/list_v.txt"; : > "$concat_v"
concat_a="$SEG/list_a.txt"; : > "$concat_a"

idx=0
for n in "${names[@]}"; do
  # --- audio segment (source of truth for duration) ---
  # ms head silence + narration + tail pad, then hard-trim to an exact length.
  narr=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$AUD/${n}.mp3")
  seg=$(python3 -c "print(round($narr + $HEAD_MS/1000 + $TAIL_S, 3))")
  frames=$(python3 -c "print(int(round($seg*$FPS)))")   # exact CFR frame count
  segdur=$(python3 -c "print(round($frames/$FPS, 6))")   # video length == frames/fps

  aout="$SEG/${n}.mp3"
  ffmpeg -y -loglevel error -i "$AUD/${n}.mp3" \
    -af "adelay=${HEAD_MS}:all=1,apad" -t "$segdur" "$aout"
  echo "file '$(pwd)/$aout'" >> "$concat_a"

  # --- video segment: clean CFR Ken Burns with a HARD frame cap ---
  # zoompan over a looped still is VFR; -frames:v (not -t) guarantees an exact
  # frame count so a later `-c copy` concat sums durations correctly.
  if (( idx % 2 == 0 )); then
    zexpr="zoom='min(zoom+0.00040,1.10)'"
  else
    zexpr="zoom='if(eq(on,1),1.10,max(zoom-0.00040,1.0))'"
  fi
  out="$SEG/${n}.mp4"
  ffmpeg -y -loglevel error -loop 1 -i "$CARDS/${n}.jpg" \
    -vf "scale=2400:1350,zoompan=${zexpr}:d=${frames}:s=1920x1080:fps=${FPS}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',fps=${FPS},format=yuv420p" \
    -frames:v ${frames} -r $FPS -c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p "$out"
  echo "file '$(pwd)/$out'" >> "$concat_v"

  nf=$(ffprobe -v error -count_frames -show_entries stream=nb_read_frames -of csv=p=0 "$out")
  echo "seg ${n}: frames=${nf}/${frames} dur=${segdur}s"
  [ "$nf" = "$frames" ] || { echo "FRAME MISMATCH in $n" >&2; exit 1; }
  idx=$((idx+1))
done

# --- assemble (lightweight, stream-copy where possible) ---
# 1) concat CFR segments with -c copy (exact, instant)
ffmpeg -y -loglevel error -f concat -safe 0 -i "$concat_v" -c copy "$SEG/_video.mp4"
# 2) concat narration
ffmpeg -y -loglevel error -f concat -safe 0 -i "$concat_a" -c:a libmp3lame -q:a 2 "$SEG/_voice.mp3"

TOTAL=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SEG/_video.mp4")
FADE=$(python3 -c "print(round($TOTAL-2,2))")
echo "TOTAL=$TOTAL"

# 3) pre-mix voice + ducked music into one audio track (music bed is longer than
#    the video, so no infinite stream_loop is needed)
ffmpeg -y -loglevel error \
  -i "$SEG/_voice.mp3" -i "$AUD/music_bed.mp3" \
  -filter_complex "[0:a]volume=1.0[v];[1:a]volume=0.14,afade=t=out:st=${FADE}:d=2[m];[v][m]amix=inputs=2:duration=first:dropout_transition=0[a]" \
  -map "[a]" -t "$TOTAL" -c:a aac -b:a 192k "$SEG/_mixed.m4a"

# 4) final mux: pure stream copy (no re-encode -> no timeout/OOM risk)
ffmpeg -y -loglevel error \
  -i "$SEG/_video.mp4" -i "$SEG/_mixed.m4a" \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a copy -movflags +faststart -shortest \
  play-store-assets/how-to-use-concrete-king.mp4

echo "BUILT play-store-assets/how-to-use-concrete-king.mp4"
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of default=noprint_wrappers=1 play-store-assets/how-to-use-concrete-king.mp4

#!/usr/bin/env bash
# Probe every generated webm: remux (MediaRecorder webms lack duration headers),
# report codec/duration/size, extract frames across the timeline, and quantify
# motion (PSNR between distant frames; lower = more motion).
set -uo pipefail
cd "$(dirname "$0")/out"
mkdir -p frames fixed
fail=0
for f in *.webm *.mp4; do
  [ -e "$f" ] || continue
  echo "== $f"
  ffmpeg -v error -y -i "$f" -c copy "fixed/$f" 2>/dev/null || { echo "   REMUX FAIL"; fail=1; continue; }
  g="fixed/$f"
  ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of default=nw=1 "$g" | sed 's/^/   /'
  ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$g" | sed 's/^/   /'
  astreams=$(ffprobe -v error -select_streams a -show_entries stream=codec_name -of csv=p=0 "$g" | tr '\n' ' ')
  echo "   audio: ${astreams:-none}"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$g")
  base="${f%.*}"
  for pct in 05 30 60 95; do
    t=$(python3 -c "print(max(0.0, float('$dur') * 0.$pct))")
    ffmpeg -v error -y -ss "$t" -i "$g" -frames:v 1 "frames/${base}-${pct}.png" || { echo "   FRAME-EXTRACT FAIL at $pct%"; fail=1; }
  done
  psnr=$(ffmpeg -v info -i "frames/${base}-05.png" -i "frames/${base}-95.png" -lavfi psnr -f null - 2>&1 | grep -o 'average:[0-9.inf]*' | cut -d: -f2)
  echo "   first-vs-last-frame PSNR: ${psnr:-n/a} (motion present if < 30, identical if inf)"
  case "$psnr" in
    inf*|"") echo "   MOTION-CHECK: FAIL (frames identical or unreadable)"; fail=1 ;;
    *) python3 -c "import sys; sys.exit(0 if float('$psnr') < 30 else 1)" \
         && echo "   MOTION-CHECK: PASS" \
         || echo "   MOTION-CHECK: WEAK (PSNR $psnr >= 30 — motion subtle)" ;;
  esac
done
exit $fail

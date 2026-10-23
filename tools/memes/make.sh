#!/bin/zsh
# Builds the meme pop-up images in public/img/memes from Imgflip templates.
# Captions are baked in with ImageMagick + Impact so the app only shows an <img>.
#   ./tools/memes/make.sh            (needs: magick, cwebp, curl; macOS ships Impact)
# Line format:  out | template file on i.imgflip.com | style | text 1 | text 2 [| text 3 | text 4]
#   style "tb"    classic white Impact, text 1 on top, text 2 at the bottom
#   style "mock"  like tb but keeps the cAsE (Mocking SpongeBob)
#   style "top"   black text in a white strip at the top (Surprised Pikachu)
#   style "right" black text in the right half, text 1 top panel, text 2 bottom panel (Drake / Pooh)
#   style "leftN" black text in the left half of N stacked panels (Expanding Brain = left4, Panik Kalm Panik = left3)
#   style "lr"    white Impact at the top of the left half (text 1) and right half (text 2) (Buff Doge vs Cheems)
set -e
cd "${0:A:h}/../.."
OUT=public/img/memes
CACHE=${TMPDIR:-/tmp}/youfloww-meme-templates
FONT=/System/Library/Fonts/Supplemental/Impact.ttf
mkdir -p $OUT $CACHE
W=640

text_png() { # file width height text style
  local f=$1 w=$2 h=$3 t=$4 st=$5
  if [[ $st == right ]]; then
    magick -background none -font "/System/Library/Fonts/Supplemental/Arial Bold.ttf" -fill black -size ${w}x${h} -gravity center caption:"$t" $f
  else
    [[ $st == mock ]] || t=${t:u}
    # outline = the filled text grown outwards, so it always matches the fill exactly
    magick -background none -font $FONT -fill white -size ${w}x${h} -gravity center caption:"$t" $f.f.png
    local ps=$(magick -background none -font $FONT -size ${w}x${h} caption:"$t" -format '%[caption:pointsize]' info:)
    magick $f.f.png -alpha extract -morphology Dilate Disk:$(( ${ps%.*} / 14 + 2 )) -background black -alpha shape $f.s.png
    magick $f.s.png $f.f.png -composite $f
    rm $f.s.png $f.f.png
  fi
}

while IFS='|' read -r out tpl style t1 t2 t3 t4; do
  out=${out// /}; tpl=${tpl// /}; style=${style// /}
  t1=${t1## }; t1=${t1%% }; t2=${t2## }; t2=${t2%% }; t3=${t3## }; t3=${t3%% }; t4=${t4## }; t4=${t4%% }
  [[ -z $out || $out == \#* ]] && continue
  [[ -f $CACHE/$tpl ]] || curl -sfL -o $CACHE/$tpl "https://i.imgflip.com/$tpl"
  base=$CACHE/$out.png
  magick $CACHE/$tpl -resize ${W}x -strip $base
  H=$(magick identify -format %h $base)
  if [[ $style == top ]]; then
    bw=$(( W - 40 )); bh=$(( H * 30 / 100 ))
    text_png $CACHE/a.png $bw $bh "$t1" right && magick $base $CACHE/a.png -geometry +20+10 -composite $base
  elif [[ $style == left[0-9] ]]; then
    n=${style#left}; texts=("$t1" "$t2" "$t3" "$t4")
    bw=$(( W / 2 - 24 )); bh=$(( H / n - 24 ))
    for i in {1..$n}; do
      [[ -n ${texts[$i]} ]] && text_png $CACHE/r$i.png $bw $bh "${texts[$i]}" right && magick $base $CACHE/r$i.png -geometry +12+$(( (i - 1) * H / n + 12 )) -composite $base
    done
  elif [[ $style == lr ]]; then
    bw=$(( W / 2 - 20 )); bh=$(( H * 24 / 100 ))
    [[ -n $t1 ]] && text_png $CACHE/a.png $bw $bh "$t1" tb && magick $base $CACHE/a.png -geometry +10+8 -composite $base
    [[ -n $t2 ]] && text_png $CACHE/b.png $bw $bh "$t2" tb && magick $base $CACHE/b.png -geometry +$(( W / 2 + 10 ))+8 -composite $base
  elif [[ $style == right ]]; then
    bw=$(( W / 2 - 24 )); bh=$(( H / 2 - 30 ))
    [[ -n $t1 ]] && text_png $CACHE/a.png $bw $bh "$t1" right && magick $base $CACHE/a.png -geometry +$(( W / 2 + 12 ))+15 -composite $base
    [[ -n $t2 ]] && text_png $CACHE/b.png $bw $bh "$t2" right && magick $base $CACHE/b.png -geometry +$(( W / 2 + 12 ))+$(( H / 2 + 15 )) -composite $base
  else
    bw=$(( W - 28 )); bh=$(( H * 22 / 100 ))
    [[ -n $t1 ]] && text_png $CACHE/a.png $bw $bh "$t1" $style && magick $base $CACHE/a.png -geometry +14+8 -composite $base
    [[ -n $t2 ]] && text_png $CACHE/b.png $bw $bh "$t2" $style && magick $base $CACHE/b.png -geometry +14+$(( H - bh - 8 )) -composite $base
  fi
  cwebp -quiet -q 78 $base -o $OUT/$out.webp
  echo "$out.webp  $(( $(stat -f%z $OUT/$out.webp) / 1024 ))KB"
done <<'EOF'
# Focus session starts
start-1 | 30b1gx.jpg  | right | Doomscrolling for 3 hours "for research" | One tiny focus session
start-2 | 1h7in3.jpg  | tb    | Can't fail the session | if you actually start it
start-3 | 3oevdk.jpg  | tb    | I am once again asking | for 25 minutes of your focus
start-4 | 1bgw.jpg    | tb    | Not sure if I'm focusing | or just staring at the timer
start-5 | 1bij.jpg    | tb    | One does not simply | open Instagram mid-session
start-6 | 3i7p.jpg    | tb    | Focus mode | Activated
start-7 | hlmst.jpg   | tb    | Look at me | I'm the focus now
start-8 | 64sz4u.png  | tb    | No distractions? |
start-9  | 8k0sa.jpg  | tb    | Do or do not | there is no "after this video"
start-10 | 9sw43.jpg  | tb    | You could finish it in 25 minutes | but that's none of my business
start-11 | 265k.jpg   | tb    | You're telling me 25 minutes | is enough to get stuff done?
start-12 | 26am.jpg   | tb    | I'm not saying I'll finish it | but I started
start-13 | 23ls.jpg   | tb    | My procrastination watching me | actually press start
start-14 | 46e43q.png | tb    | Wait, the hardest part is just starting? | Always has been
start-15 | 28j0te.jpg | tb    | Me and my brain | finally agreeing to focus
start-16 | 24y43o.jpg | tb    | | 25 minutes isn't that long. Change my mind
start-17 | 345v97.jpg | tb    | My brain: check your phone | Me: *starts the timer*
start-18 | 2gnnjh.jpg | tb    | When the timer starts | and you realise you actually have to work
start-19 | 1jwhww.jpg | left4 | Waiting for motivation | Making a to-do list | Making a to-do list for the to-do list | Pressing start before thinking
start-20 | bwu6w.jpg  | tb    | Me staring at the play button | C'mon, do something
# Focus session completed
done-1 | 39t1o.jpg   | tb    | Here's to you, legend | who just finished a focus session
done-2 | 1bhk.jpg    | tb    | Finished the whole session | didn't touch my phone once
done-3 | 8d317n.png  | tb    | That focus session? | Absolute cinema
done-4 | gtj5t.jpg   | tb    | You get a break! | Everybody gets a break!
done-5 | 2ybua0.png  | right | Doing some work | Completing a full deep-focus session
done-6 | 4acd7j.png  | tb    | Me watching my to-do list | get shorter
done-7 | 1iruch.jpg  | right | Taking a break before working | Taking a break because I earned it
done-8  | 21uy0f.jpg | tb    | Y'all got any more of that | focus dopamine?
done-9  | 5o32tt.png | tb    | You scroll for dopamine. I finish sessions for dopamine | We are not the same
done-10 | 1o00in.jpg | tb    | Me after one focus session | Is this... productivity?
done-11 | 4pn1an.png | tb    | They don't know I just finished | a whole focus session
done-12 | 27qxmb.jpg | tb    | Finished one session | I'm something of a productivity guru myself
done-13 | 1tl71a.jpg | tb    | I bet he's thinking about other women | Him: finished a session without opening Instagram
done-14 | 54hjww.jpg | tb    | Trade offer: I receive a break | You receive 25 minutes of focus
done-15 | 43a45p.png | lr    | Me after a focus session | Me after 3 hours of reels
done-16 | 1op9wy.jpg | tb    | Psst... you just finished | a whole focus session
done-17 | 19vcz0.jpg | tb    | I'll give you one 5 minute break | Best I can do
done-18 | 1itoun.jpg | tb    | Me explaining to my friends | how a 25 minute timer fixed my life
done-19 | 2xscjb.png | tb    | You guys are getting breaks? | Oh wait, I earned one
done-20 | 392xtu.jpg | tb    | Me when the session ends |
# Focus session ended early
quit-1 | wxica.jpg   | tb    | Me after quitting early |
quit-2 | 2fm6x.jpg   | tb    | Me waiting for the task | to do itself
quit-3 | 1otk96.jpg  | mock   | | i'Ll FoCuS tOmOrRoW
quit-4 | gk5el.jpg   | tb    | Ended early | every minute still counts though
quit-6  | 3lmzyx.jpg | tb    | Finish the session or draw 25 | *draws 25*
quit-7  | 1b42wl.jpg | tb    | Me quitting the session early | Me surprised the work isn't done
quit-8  | 1c1uej.jpg | tb    | Me after quitting early | waiting for motivation to come back
quit-9  | 5c7lwq.png | tb    | You're going to finish the session, right? | ...right?
quit-10 | 5v6gwj.jpg | tb    | Me who quit early | Everyone who finished the session
quit-11 | 72epa9.png | tb    | | quitting a session early
quit-12 | 1bip.jpg   | tb    | Quits the session early | task was 2 minutes from done
quit-13 | 145qvv.jpg | tb    | Me watching everyone else | finish their focus sessions
quit-14 | 38el31.jpg | left4 | I'll just stop for a minute | A quick break won't hurt | I'll finish it tomorrow | Tomorrow me: I'll finish it tomorrow
quit-15 | 1e7ql7.jpg | tb    | Me: I'll finish this session | Also me: quit, nobody's watching
quit-16 | 1wz1x.jpg  | tb    | This is where I'd put my trophy | if I'd finished the session
quit-17 | 3qqcim.png | left3 | Quit the session early | Eh, it's just a little break | The break started 3 hours ago
quit-18 | 3nx72a.png | tb    | Me visiting the task | I said I'd finish "in 5 minutes"
quit-19 | 1g8my4.jpg | tb    | Finish the session vs open Instagram | *sweating intensifies*
quit-20 | 1tkjq9.jpg | tb    | Me who quit today | pointing at me who quit yesterday
quit-5 | 2kbn1e.jpg  | top   | Me: quits after 5 minutes. Also me: wait, why did nothing get done? |
EOF

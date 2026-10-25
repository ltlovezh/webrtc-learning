#!/usr/bin/env python3
"""生成「5 分钟全貌」的旁白音频与时间轴。

用法（在仓库根目录）：
    python3 overview/build.py

- 读取 overview/narration.json，逐句调用 mmx（MiniMax TTS）合成；
- 每句结果按（音色、模型、朗读文字）缓存到 overview/.tts-cache/，改哪句只重新合成哪句；
- 用 ffmpeg 把每章的句子拼成 overview/chN.mp3（句间留 gap_ms 静音）；
- 把每句的起止时间写进 webrtc-overview.html 里 TIMELINE 标记之间。

依赖：mmx（已登录）、ffmpeg、ffprobe。
"""
import hashlib, json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OV = os.path.join(ROOT, 'overview')
CACHE = os.path.join(OV, '.tts-cache')
PAGE = os.path.join(ROOT, 'webrtc-overview.html')
SR = 32000


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit('命令失败：%s\n%s' % (' '.join(cmd), r.stderr[-800:]))
    return r.stdout


def duration(path):
    return float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).strip())


def synth(text, voice, model):
    key = hashlib.sha1(('%s|%s|%s' % (voice, model, text)).encode('utf-8')).hexdigest()[:16]
    mp3 = os.path.join(CACHE, key + '.mp3')
    if not os.path.exists(mp3):
        print('  合成：' + text[:28] + '…')
        run(['mmx', 'speech', 'synthesize', '--non-interactive', '--quiet', '--model', model, '--voice', voice,
             '--language', 'Chinese', '--text', text, '--out', mp3])
    return mp3


def main():
    cfg = json.load(open(os.path.join(OV, 'narration.json'), encoding='utf-8'))
    os.makedirs(CACHE, exist_ok=True)
    gap = cfg.get('gap_ms', 380) / 1000
    lead = 0.25
    timeline = []
    with tempfile.TemporaryDirectory() as tmp:
        silence = os.path.join(tmp, 'gap.wav')
        run(['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=%d:cl=mono' % SR, '-t', str(gap), silence])
        head = os.path.join(tmp, 'lead.wav')
        run(['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=%d:cl=mono' % SR, '-t', str(lead), head])
        for ci, ch in enumerate(cfg['chapters']):
            print('第 %d 章：%s' % (ci + 1, ch['title']))
            parts, cues, t = [head], [], lead
            for k, cue in enumerate(ch['cues']):
                mp3 = synth(cue['tts'], cfg['voice'], cfg['model'])
                wav = os.path.join(tmp, '%s_%d.wav' % (ch['id'], k))
                run(['ffmpeg', '-y', '-v', 'error', '-i', mp3, '-ar', str(SR), '-ac', '1', wav])
                d = duration(wav)
                cues.append({'t0': round(t, 3), 't1': round(t + d, 3), 'scene': cue['scene'], 'sub': cue['sub']})
                parts += [wav, silence]
                t += d + gap
            lst = os.path.join(tmp, ch['id'] + '.txt')
            with open(lst, 'w') as f:
                f.writelines("file '%s'\n" % p for p in parts)
            out = os.path.join(OV, ch['id'] + '.mp3')
            run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lst,
                 '-ac', '1', '-ar', str(SR), '-codec:a', 'libmp3lame', '-b:a', '64k', out])
            timeline.append({'id': ch['id'], 'title': ch['title'], 'more': ch['more'],
                             'src': 'overview/' + ch['id'] + '.mp3', 'dur': round(duration(out), 3), 'cues': cues})
            print('  → %s，%.1f 秒' % (os.path.relpath(out, ROOT), timeline[-1]['dur']))

    page = open(PAGE, encoding='utf-8').read()
    a, b = '/*TIMELINE-START*/', '/*TIMELINE-END*/'
    i, j = page.index(a) + len(a), page.index(b)
    page = page[:i] + 'const TIMELINE = ' + json.dumps(timeline, ensure_ascii=False) + ';' + page[j:]
    open(PAGE, 'w', encoding='utf-8').write(page)
    total = sum(c['dur'] for c in timeline)
    print('时间轴已写入 webrtc-overview.html，总长 %d 分 %d 秒' % (total // 60, total % 60))


if __name__ == '__main__':
    main()

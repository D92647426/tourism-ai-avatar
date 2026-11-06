"""TEST-053 worker HTTP validation/concurrency without real model weights."""
import importlib.util
import io
import json
from pathlib import Path
import threading
import unittest
import urllib.request
import urllib.error
import wave

SPEC = importlib.util.spec_from_file_location('local_voice_server',Path(__file__).parents[1]/'scripts/local_voice_server.py')
worker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(worker)


class WorkerTest(unittest.TestCase):
    def test_inherited_ai_greeting_needs_no_language_model_download(self):
        self.assertEqual(worker.spoken_text('我是您的AI导游，前往B区。'),'我是您的人工智能导游，前往比区。')
        self.assertEqual(worker.spoken_text('中文景点16个。'),'中文景点16个。')
    def test_validation(self):
        for bad in [{}, {'text':' '}, {'text':'x'*81}, {'text':'x','speed':True}, {'text':'x','speed':0.4}, {'text':'x','url':'bad'}, {'text':'\ud800'}]:
            with self.assertRaises(ValueError): worker.validate(bad)
        self.assertEqual(worker.validate({'text':'你好','speed':0.5}),('你好',0.5))

    def test_http_wav_health_and_busy_are_bounded(self):
        entered=threading.Event(); release=threading.Event()
        def synth(text,speed):
            entered.set();release.wait(3)
            output=io.BytesIO()
            with wave.open(output,'wb') as wav:
                wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(32000);wav.writeframes(b'\x01\x01'*3200)
            return output.getvalue()
        state=worker.State(synth)
        server=worker.make_server(0,state)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        base='http://127.0.0.1:'+str(server.server_port)
        def request():
            req=urllib.request.Request(base+'/synthesize',data=json.dumps({'text':'你好','speed':1}).encode(),headers={'Content-Type':'application/json'})
            with urllib.request.urlopen(req,timeout=5) as response:
                self.assertEqual(response.headers['Cache-Control'],'no-store');return response.read()
        try:
            with urllib.request.urlopen(base+'/health') as response:self.assertEqual(json.load(response),{'ready':True})
            state.slots.acquire(); state.slots.acquire()
            with self.assertRaises(urllib.error.HTTPError) as error: request()
            self.assertEqual(error.exception.code,503)
            state.slots.release();state.slots.release();release.set()
            self.assertTrue(request().startswith(b'RIFF'))
        finally:release.set();server.shutdown();server.server_close();thread.join(2)


if __name__=='__main__':unittest.main()

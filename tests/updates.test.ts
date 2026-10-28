import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { UpdateController } from '../electron/updates.js';
class FakeUpdater extends EventEmitter {
  checks = 0;
  downloads = 0;
  installs = 0;
  check: () => Promise<unknown> = async () => {
    this.emit('update-available', { version: '0.4.0' });
  };
  download: () => Promise<unknown> = async () => {
    this.emit('update-downloaded', { version: '0.4.0' });
  };
  async checkForUpdates() {
    this.checks++;
    return this.check();
  }
  async downloadUpdate() {
    this.downloads++;
    return this.download();
  }
  quitAndInstall() {
    this.installs++;
  }
}
test('development/unsupported installs never contact a provider or restart', async () => {
  let backedUp = false;
  const c = new UpdateController(null, '0.3.0', async () => {
    backedUp = true;
  });
  await c.check();
  await c.download();
  await c.install();
  assert.equal(c.status().phase, 'unsupported');
  assert.equal(backedUp, false);
});
test('available update needs a separate download and install, with backup before restart', async () => {
  const f = new FakeUpdater();
  let backups = 0;
  const c = new UpdateController(f, '0.3.0', async () => {
    assert.equal(f.installs, 0);
    backups++;
  });
  await c.install();
  await c.download();
  assert.equal(f.installs, 0);
  assert.equal(f.downloads, 0);
  await c.check();
  assert.equal(c.status().phase, 'available');
  assert.equal(f.downloads, 0);
  await c.download();
  assert.equal(c.status().phase, 'ready');
  assert.equal(f.installs, 0);
  await c.install();
  assert.equal(backups, 1);
  assert.equal(f.installs, 1);
});
test('network failures are recoverable and do not leak transport details', async () => {
  const f = new FakeUpdater();
  f.check = async () => {
    throw new Error('token=do-not-display');
  };
  const c = new UpdateController(f, '0.3.0', async () => {});
  await c.check();
  assert.equal(c.status().phase, 'error');
  assert.ok(!c.status().message.includes('token='));
  f.check = async () => {
    f.emit('update-not-available');
  };
  await c.check();
  assert.equal(c.status().phase, 'current');
});
test('failed or unverified downloads cannot be installed', async () => {
  const f = new FakeUpdater();
  const c = new UpdateController(f, '0.3.0', async () => {});
  f.download = async () => {
    f.emit('error', new Error('checksum mismatch'));
    throw new Error('failed');
  };
  await c.check();
  await c.download();
  await c.install();
  assert.equal(c.status().phase, 'error');
  assert.equal(f.installs, 0);
  // A delayed event from a failed attempt must not make it installable.
  f.emit('update-downloaded', { version: '0.4.0' });
  assert.equal(c.status().phase, 'error');
});
test('backup failure prevents restart and allows a retry', async () => {
  const f = new FakeUpdater();
  let fail = true;
  const c = new UpdateController(f, '0.3.0', async () => {
    if (fail) throw new Error('disk full');
  });
  await c.check();
  await c.download();
  await c.install();
  assert.equal(f.installs, 0);
  assert.equal(c.status().phase, 'ready');
  fail = false;
  await c.install();
  assert.equal(f.installs, 1);
});
test('duplicate clicks cannot start concurrent network requests', async () => {
  const f = new FakeUpdater();
  let finish!: () => void;
  f.check = () =>
    new Promise<void>((resolve) => {
      finish = () => {
        f.emit('update-available', { version: '0.4.0' });
        resolve();
      };
    });
  const c = new UpdateController(f, '0.3.0', async () => {});
  const first = c.check();
  await c.check();
  assert.equal(f.checks, 1);
  finish();
  await first;
  f.download = () =>
    new Promise<void>((resolve) => {
      finish = () => {
        f.emit('update-downloaded', { version: '0.4.0' });
        resolve();
      };
    });
  const pending = c.download();
  await c.download();
  assert.equal(f.downloads, 1);
  finish();
  await pending;
  assert.equal(c.status().phase, 'ready');
});
test('progress is bounded and status callers cannot mutate controller state', async () => {
  const f = new FakeUpdater();
  let finish!: () => void;
  f.download = () =>
    new Promise<void>((resolve) => {
      finish = resolve;
    });
  const c = new UpdateController(f, '0.3.0', async () => {});
  await c.check();
  const pending = c.download();
  f.emit('download-progress', { percent: 150 });
  assert.equal(c.status().progress, 100);
  f.emit('download-progress', { percent: NaN });
  assert.equal(c.status().progress, 100);
  c.status().phase = 'ready';
  assert.equal(c.status().phase, 'downloading');
  finish();
  await pending;
});

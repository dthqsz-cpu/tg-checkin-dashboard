/* 读取 data/events.json，按天聚合后画成台账。没有依赖、没有构建步骤。 */
(function () {
  'use strict';

  var DATA_URL = 'data/events.json';
  var WEEKS = 26;
  var TABLE_DAYS = 30;
  var DAY_MS = 86400000;

  var RESULT_TEXT = {
    ok: '签到成功',
    already: '已经签过',
    fail: '失败',
    unknown: '结果未知',
    skipped: '备援跳过'
  };

  /* ---------- 日期小工具（一律按北京时间算） ---------- */

  function bjToday() {
    return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  }

  function toDate(str) {
    return new Date(str + 'T00:00:00Z');
  }

  function shift(str, n) {
    var d = toDate(str);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function weekday(str) {
    return (toDate(str).getUTCDay() + 6) % 7; // 0 = 周一
  }

  function shortDate(str) {
    var p = str.split('-');
    return Number(p[1]) + '/' + Number(p[2]);
  }

  function daysBetween(a, b) {
    return Math.round((toDate(b) - toDate(a)) / DAY_MS);
  }

  /* ---------- 聚合 ---------- */

  function aggregate(list) {
    var days = {};
    list.forEach(function (e) {
      if (!e || typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
        return;
      }
      var day = days[e.date] || (days[e.date] = {
        date: e.date, runs: 0, ok: 0, bad: 0, idle: 0,
        signed: null, problem: null, quiz: 'none', note: '', first: null
      });
      day.runs += 1;
      if (!day.first) day.first = e;
      if (e.result === 'ok' || e.result === 'already') {
        day.ok += 1;
        if (!day.signed) day.signed = e;
      } else if (e.result === 'fail' || e.result === 'unknown') {
        day.bad += 1;
        if (!day.problem) day.problem = e;
      } else {
        day.idle += 1;
      }
      if (e.quiz === 'answered') day.quiz = 'answered';
      else if (e.quiz === 'error' && day.quiz !== 'answered') day.quiz = 'error';
      if (e.note && !day.note) day.note = e.note;
    });
    Object.keys(days).forEach(function (key) {
      var day = days[key];
      day.status = day.ok ? 'ok' : (day.bad ? 'bad' : 'idle');
    });
    return days;
  }

  function sortedDays(days) {
    return Object.keys(days).sort().map(function (k) { return days[k]; });
  }

  function creditsOf(record) {
    if (!record || typeof record.credits_before !== 'number') return null;
    var bonus = typeof record.reward === 'number' ? record.reward : 0;
    return record.credits_before + bonus;
  }

  /* ---------- 顶部四栏 ---------- */

  function setText(id, text) {
    var node = document.getElementById(id);
    if (node) node.textContent = text;
  }

  function renderStrip(days) {
    var today = bjToday();
    var mine = days[today];

    var todayValue = document.getElementById('v-today');
    if (!mine) {
      todayValue.textContent = '还没有记录';
      todayValue.className = 'field-value';
      setText('n-today', '今天 00:01 之后才会出现');
    } else if (mine.status === 'ok') {
      todayValue.textContent = '已签到';
      todayValue.className = 'field-value ok-text';
      setText('n-today', (mine.signed && mine.signed.time ? mine.signed.time : '') +
        ' 签上 · 今天共 ' + mine.runs + ' 次触发');
    } else if (mine.status === 'bad') {
      todayValue.textContent = '没签上';
      todayValue.className = 'field-value bad-text';
      setText('n-today', '今天共 ' + mine.runs + ' 次触发');
    } else {
      todayValue.textContent = '只有备援跳过';
      todayValue.className = 'field-value';
      setText('n-today', '今天共 ' + mine.runs + ' 次触发');
    }

    var ordered = sortedDays(days);
    var latestStreak = null;
    var latestMonth = null;
    var latestCredits = null;
    for (var i = ordered.length - 1; i >= 0; i -= 1) {
      var day = ordered[i];
      if (latestCredits === null && creditsOf(day.signed) !== null) {
        latestCredits = { value: creditsOf(day.signed), date: day.date };
      }
      if (latestStreak === null && day.signed && typeof day.signed.streak === 'number') {
        latestStreak = { value: day.signed.streak, date: day.date };
      }
      if (latestMonth === null && day.signed && typeof day.signed.month_days === 'number') {
        latestMonth = { value: day.signed.month_days, date: day.date };
      }
    }

    setText('v-streak', latestStreak ? String(latestStreak.value) : '—');
    setText('n-streak', latestStreak
      ? (latestStreak.date === today ? '天 · 今天' : '天 · 截至 ' + shortDate(latestStreak.date))
      : '天');

    setText('v-month', latestMonth ? String(latestMonth.value) : '—');
    setText('n-month', latestMonth
      ? '天 · ' + Number(latestMonth.date.split('-')[1]) + ' 月'
      : '天');

    setText('v-credits', latestCredits ? String(latestCredits.value) : '—');
    setText('n-credits', latestCredits ? 'CR · ' + shortDate(latestCredits.date) + ' 签到后' : 'CR');
  }

  /* ---------- 日历 ---------- */

  function renderCalendar(days) {
    var today = bjToday();
    var lastMonday = shift(today, -weekday(today));
    var firstDay = shift(lastMonday, -(WEEKS - 1) * 7);
    var grid = document.getElementById('cal-grid');
    var months = document.getElementById('cal-months');

    grid.innerHTML = '';
    months.innerHTML = '';
    months.style.setProperty('--weeks', WEEKS);
    grid.style.setProperty('--i', 0);

    var lastMonth = null;
    var index = 0;

    for (var w = 0; w < WEEKS; w += 1) {
      var columnMonday = shift(firstDay, w * 7);
      var month = columnMonday.slice(0, 7);
      if (month !== lastMonth) {
        var label = document.createElement('span');
        label.textContent = Number(month.slice(5)) + '月';
        label.style.gridColumn = String(w + 1);
        months.appendChild(label);
        lastMonth = month;
      }
      for (var d = 0; d < 7; d += 1) {
        var date = shift(firstDay, w * 7 + d);
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.setProperty('--i', index);
        index += 1;
        if (date > today) {
          cell.classList.add('cell-future');
          cell.title = shortDate(date) + ' · 还没到';
        } else {
          var day = days[date];
          var kind = !day ? 'none' : (day.status === 'ok' ? 'ok' : (day.status === 'bad' ? 'bad' : 'idle'));
          if (kind === 'ok') cell.classList.add('cell-ok');
          else if (kind === 'bad') cell.classList.add('cell-bad');
          else if (kind === 'idle') cell.classList.add('cell-idle');
          cell.title = shortDate(date) + ' · ' + describe(day);
        }
        grid.appendChild(cell);
      }
    }

    grid.classList.add('ready');
    setText('cal-range', shortDate(firstDay) + ' – ' + shortDate(today));
  }

  function describe(day) {
    if (!day) return '没有记录';
    if (day.status === 'ok') {
      return '签到成功' + (day.signed && day.signed.time ? ' ' + day.signed.time : '');
    }
    if (day.status === 'bad') return '失败或结果未知';
    return '只有备援触发，已签过';
  }

  /* ---------- 积分趋势 ---------- */

  function renderTrend(days) {
    var box = document.getElementById('trend');
    box.innerHTML = '';
    var points = sortedDays(days)
      .map(function (day) {
        var value = creditsOf(day.signed);
        return value === null ? null : { date: day.date, value: value };
      })
      .filter(Boolean);

    if (!points.length) {
      box.textContent = '还没有带积分的记录。';
      return;
    }

    var W = 640;
    var H = 220;
    var padL = 46;
    var padR = 16;
    var padT = 16;
    var padB = 30;
    var values = points.map(function (p) { return p.value; });
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    if (max === min) { max = min + 1; }
    var span = max - min;
    min -= span * 0.15;
    max += span * 0.15;

    function x(i) {
      if (points.length === 1) return padL + (W - padL - padR) / 2;
      return padL + (i * (W - padL - padR)) / (points.length - 1);
    }
    function y(v) {
      return padT + (H - padT - padB) * (1 - (v - min) / (max - min));
    }

    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '积分余额折线图，从 ' + points[0].value + ' 变化到 ' + points[points.length - 1].value);

    [min + (max - min) * 0.5, max - (max - min) * 0.15].forEach(function (tick) {
      var line = document.createElementNS(ns, 'line');
      line.setAttribute('class', 'grid-line');
      line.setAttribute('x1', padL);
      line.setAttribute('x2', W - padR);
      line.setAttribute('y1', y(tick));
      line.setAttribute('y2', y(tick));
      svg.appendChild(line);
      var text = document.createElementNS(ns, 'text');
      text.setAttribute('class', 'axis-text');
      text.setAttribute('x', '0');
      text.setAttribute('y', y(tick) + 4);
      text.textContent = String(Math.round(tick));
      svg.appendChild(text);
    });

    var d = points.map(function (p, i) {
      return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.value).toFixed(1);
    }).join(' ');
    var area = document.createElementNS(ns, 'path');
    area.setAttribute('class', 'area');
    area.setAttribute('d', d + ' L' + x(points.length - 1).toFixed(1) + ' ' + (H - padB) +
      ' L' + x(0).toFixed(1) + ' ' + (H - padB) + ' Z');
    svg.appendChild(area);

    var line = document.createElementNS(ns, 'path');
    line.setAttribute('class', 'line');
    line.setAttribute('d', d);
    svg.appendChild(line);

    var dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('class', 'dot');
    dot.setAttribute('cx', x(points.length - 1));
    dot.setAttribute('cy', y(points[points.length - 1].value));
    dot.setAttribute('r', 4);
    svg.appendChild(dot);

    [[points[0], 0], [points[points.length - 1], 1]].forEach(function (pair) {
      var text = document.createElementNS(ns, 'text');
      text.setAttribute('class', 'axis-text');
      text.setAttribute('x', x(pair[1] ? points.length - 1 : 0));
      text.setAttribute('y', H - 8);
      text.setAttribute('text-anchor', pair[1] ? 'end' : 'start');
      text.textContent = shortDate(pair[0].date);
      svg.appendChild(text);
    });

    box.appendChild(svg);
  }

  /* ---------- 明细表 ---------- */

  function renderTable(days) {
    var today = bjToday();
    var body = document.getElementById('rows');
    body.innerHTML = '';
    var list = sortedDays(days).slice(-TABLE_DAYS).reverse();

    list.forEach(function (day) {
      var tr = document.createElement('tr');
      if (day.date === today) tr.className = 'today';

      var record = day.signed || day.problem || day.first;
      var credits = creditsOf(day.signed);

      appendCell(tr, shortDate(day.date), 'date');
      appendCell(tr, day.signed && day.signed.time ? day.signed.time : '—');

      var tag = document.createElement('td');
      var badge = document.createElement('span');
      var text = day.status === 'ok'
        ? (day.signed && day.signed.result === 'already' ? '已经签过' : '签到成功')
        : (day.status === 'bad' ? (RESULT_TEXT[day.problem && day.problem.result] || '失败') : '备援跳过');
      badge.className = 'tag ' + (day.status === 'ok' ? 'tag-ok' : (day.status === 'bad' ? 'tag-bad' : 'tag-idle'));
      badge.textContent = text;
      tag.appendChild(badge);
      tr.appendChild(tag);

      appendCell(tr, day.signed && typeof day.signed.streak === 'number' ? String(day.signed.streak) : '—');
      appendCell(tr, day.signed && typeof day.signed.month_days === 'number' ? String(day.signed.month_days) : '—');
      appendCell(tr, credits === null ? '—' :
        String(credits) + (day.signed && typeof day.signed.reward === 'number' ? ' (+' + day.signed.reward + ')' : ''));

      var quiz = '—';
      if (day.quiz === 'answered') quiz = '出了，已答';
      else if (day.quiz === 'error') quiz = '出了，没答上';
      appendCell(tr, quiz);

      var note = day.note || '';
      if (!note && day.status === 'idle' && day.idle > 0) {
        note = '备援 ' + day.idle + ' 次，发现当天已签到，没有打扰机器人';
      }
      if (!note && day.runs > 1 && day.status === 'ok') {
        note = '当天共 ' + day.runs + ' 次触发';
      }
      if (!note && record && record.result === 'already') note = '机器人回复「已经签过」';
      appendCell(tr, note || '', 'note');
      body.appendChild(tr);
    });

    if (!list.length) {
      setText('table-note', '暂无数据');
    } else {
      setText('table-note', '最近 ' + list.length + ' 天，按天汇总');
    }
  }

  function appendCell(tr, text, className) {
    var td = document.createElement('td');
    td.textContent = text;
    if (className) td.className = className;
    tr.appendChild(td);
  }

  /* ---------- 异常提示 ---------- */

  function renderAlert(days) {
    var box = document.getElementById('alert');
    var today = bjToday();
    var problems = [];

    for (var i = 1; i <= 7; i += 1) {
      var date = shift(today, -i);
      var day = days[date];
      if (!day) {
        problems.push(shortDate(date) + ' 一整天没有签到记录');
      } else if (day.status === 'bad') {
        problems.push(shortDate(date) + ' 签到失败或结果未知' + (day.problem && day.problem.note ? '（' + day.problem.note + '）' : ''));
      }
    }

    if (!problems.length) {
      box.hidden = true;
      return;
    }

    var head = document.createElement('strong');
    head.textContent = '最近 7 天有 ' + problems.length + ' 处异常：';
    var ul = document.createElement('ul');
    problems.forEach(function (text) {
      var li = document.createElement('li');
      li.textContent = text;
      ul.appendChild(li);
    });
    box.innerHTML = '';
    box.appendChild(head);
    box.appendChild(ul);
    box.hidden = false;
  }

  /* ---------- 入口 ---------- */

  function fail(message) {
    setText('v-today', '读不到数据');
    setText('n-today', message);
    document.getElementById('table-note').textContent = '暂无数据';
    setText('updated', '读取失败：' + message);
  }

  fetch(DATA_URL, { cache: 'no-store' })
    .then(function (resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    })
    .then(function (list) {
      if (!Array.isArray(list) || !list.length) {
        fail('数据文件还是空的');
        return;
      }
      var days = aggregate(list);
      renderStrip(days);
      renderCalendar(days);
      renderTrend(days);
      renderTable(days);
      renderAlert(days);
      var last = list.reduce(function (acc, e) {
        if (!e || typeof e.time !== 'string' || typeof e.date !== 'string') return acc;
        var stamp = e.date + ' ' + e.time;
        return stamp > acc ? stamp : acc;
      }, '');
      setText('updated', '最后一条记录：' + (last || '—') + '（北京时间）· 数据文件共 ' + list.length + ' 条');
    })
    .catch(function (err) {
      fail(err && err.message ? err.message : String(err));
    });
}());

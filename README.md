# 签到台账

一个私人用的每日签到看板：打开网页就能看到今天签没签上、连续签到多少天、
本月签到多少天、积分怎么变的。

网址：<https://dthqsz-cpu.github.io/tg-checkin-dashboard/>

## 数据从哪来

另一个私有仓库每天凌晨自动签到一次，签完把一条记录追加到本仓库的
`data/events.json`。除了这条数据线，两个仓库之间没有任何其他联系。

## 一条记录长这样

```json
{
  "date": "2026-09-28",
  "time": "00:01",
  "trigger": "cronjob",
  "result": "ok",
  "streak": 18,
  "month_days": 27,
  "credits_before": 1484,
  "reward": 6,
  "quiz": "answered",
  "note": ""
}
```

| 字段 | 含义 |
| --- | --- |
| `date` / `time` | 这次运行发生的北京时间 |
| `trigger` | `cronjob` 准点触发、`schedule` 定时备援、`manual` 手动重跑 |
| `result` | `ok` 签上了、`already` 本来就是签过的、`skipped` 当天已经签过所以整轮跳过、`unknown` 没拿到明确结果、`fail` 失败 |
| `streak` / `month_days` | 机器人报的连续签到天数和本月签到天数 |
| `credits_before` / `reward` | 签到前的积分余额、这次拿到的积分 |
| `quiz` | `none` 没出题、`answered` 出了备用网址题并答上、`error` 出了题但没答上 |
| `note` | 出问题时的一句话原因，正常时为空 |

## 这里有什么、没有什么

只有签到日期、时间、天数、积分和一句状态备注。

没有账号 id、用户名、手机号、登录会话、机器人与人的聊天原文，也没有任何令牌。
本仓库是公开的，任何人都能看到这些数字——所以数据里不该有的东西，一开始就没让它进来。

## 页面怎么工作

原生 HTML + CSS + JavaScript，零依赖、零构建、不引 CDN。`index.html` 读
`data/events.json`，按天聚合后画日历、折线图和明细表。推送即部署，由
`.github/workflows/deploy.yml` 发布到 GitHub Pages。

## 历史数据说明

2026-09-25 之前的记录是脚本调试期的产物（同一个问题反复重跑、机器人明确说
「今日未签到」时也被判成成功），没有放进这里，所以日历上那几天是空的。
2026-09-25 起为完整记录。

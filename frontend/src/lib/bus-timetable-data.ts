import type { BusTimetable } from './bus-departures';

// 関越交通 前橋渋川線 通過時刻予定表(土日祝) 2024年6月1日改正のうち、
// 群馬大学荒牧・前橋自動車教習所前に停車する便だけを抜き出した同梱データ。
// 平日ダイヤは持たない。ダイヤ改正時はこのファイルを差し替える。
export const BUS_TIMETABLE: BusTimetable = {
  revision: '2024-06-01改正 土日祝',
  holiday: [
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '06:43' }],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '07:03' }],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '07:23' }],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '07:48' }],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '08:08' }],
    },
    {
      route: '22H',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [
        { stop: 'gunma_univ_aramaki', time: '08:10' },
        { stop: 'driving_school', time: '08:12' },
      ],
    },
    {
      route: '22B',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [
        { stop: 'gunma_univ_aramaki', time: '08:25' },
        { stop: 'driving_school', time: '08:27' },
      ],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '08:48' }],
    },
    {
      route: '22H',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [
        { stop: 'gunma_univ_aramaki', time: '09:00' },
        { stop: 'driving_school', time: '09:02' },
      ],
    },
    {
      route: '22B',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [
        { stop: 'gunma_univ_aramaki', time: '09:15' },
        { stop: 'driving_school', time: '09:17' },
      ],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '09:33' }],
    },
    {
      route: '22H',
      destination: 'けやきウォーク前橋',
      direction: 'maebashi',
      departures: [
        { stop: 'gunma_univ_aramaki', time: '09:48' },
        { stop: 'driving_school', time: '09:50' },
      ],
    },
    {
      route: '22B',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '10:23' }],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '10:48' }],
    },
    {
      route: '22L',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '10:57' }],
    },
    {
      route: '22B',
      destination: 'けやきウォーク前橋',
      direction: 'maebashi',
      departures: [
        { stop: 'gunma_univ_aramaki', time: '11:20' },
        { stop: 'driving_school', time: '11:22' },
      ],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '11:49' }],
    },
    {
      route: '22K',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [
        { stop: 'gunma_univ_aramaki', time: '11:58' },
        { stop: 'driving_school', time: '12:00' },
      ],
    },
    {
      route: '22B',
      destination: 'けやきウォーク前橋',
      direction: 'maebashi',
      departures: [
        { stop: 'gunma_univ_aramaki', time: '12:20' },
        { stop: 'driving_school', time: '12:22' },
      ],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '12:48' }],
    },
    {
      route: '22L',
      destination: 'けやきウォーク前橋',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '12:57' }],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '13:23' }],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '13:48' }],
    },
    {
      route: '22K',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [
        { stop: 'gunma_univ_aramaki', time: '13:55' },
        { stop: 'driving_school', time: '13:57' },
      ],
    },
    {
      route: '22B',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [
        { stop: 'gunma_univ_aramaki', time: '14:20' },
        { stop: 'driving_school', time: '14:22' },
      ],
    },
    {
      route: '22A',
      destination: 'けやきウォーク前橋',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '14:52' }],
    },
    {
      route: '22L',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '14:57' }],
    },
    {
      route: '22B',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [
        { stop: 'gunma_univ_aramaki', time: '15:20' },
        { stop: 'driving_school', time: '15:22' },
      ],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '15:48' }],
    },
    {
      route: '22G',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [
        { stop: 'gunma_univ_aramaki', time: '16:00' },
        { stop: 'driving_school', time: '16:02' },
      ],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '16:18' }],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '16:43' }],
    },
    {
      route: '22L',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '17:09' }],
    },
    {
      route: '22B',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [
        { stop: 'gunma_univ_aramaki', time: '17:20' },
        { stop: 'driving_school', time: '17:22' },
      ],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '18:03' }],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '18:28' }],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '19:03' }],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '20:03' }],
    },
    {
      route: '22A',
      destination: '前橋駅',
      direction: 'maebashi',
      departures: [{ stop: 'driving_school', time: '20:52' }],
    },
    {
      route: '22A',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '07:28' }],
    },
    {
      route: '22B',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [
        { stop: 'driving_school', time: '07:49' },
        { stop: 'gunma_univ_aramaki', time: '07:51' },
      ],
    },
    {
      route: '22K',
      destination: '群馬大学荒牧',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '08:02' }],
    },
    {
      route: '22B',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [
        { stop: 'driving_school', time: '08:12' },
        { stop: 'gunma_univ_aramaki', time: '08:14' },
      ],
    },
    {
      route: '22B',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [
        { stop: 'driving_school', time: '08:32' },
        { stop: 'gunma_univ_aramaki', time: '08:34' },
      ],
    },
    {
      route: '22K',
      destination: '群馬大学荒牧',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '08:51' }],
    },
    {
      route: '22A',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '08:56' }],
    },
    {
      route: '22B',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [
        { stop: 'driving_school', time: '09:17' },
        { stop: 'gunma_univ_aramaki', time: '09:19' },
      ],
    },
    {
      route: '22K',
      destination: '群馬大学荒牧',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '09:39' }],
    },
    {
      route: '22B',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [
        { stop: 'driving_school', time: '09:50' },
        { stop: 'gunma_univ_aramaki', time: '09:52' },
      ],
    },
    {
      route: '22A',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '10:19' }],
    },
    {
      route: '22L',
      destination: '道の駅まえばし赤城',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '10:33' }],
    },
    {
      route: '22B',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [
        { stop: 'driving_school', time: '10:50' },
        { stop: 'gunma_univ_aramaki', time: '10:52' },
      ],
    },
    {
      route: '22A',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '11:16' }],
    },
    {
      route: '22M',
      destination: '群馬大学荒牧',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '11:41' }],
    },
    {
      route: '22A',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '12:00' }],
    },
    {
      route: '22L',
      destination: '道の駅まえばし赤城',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '12:33' }],
    },
    {
      route: '22B',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [
        { stop: 'driving_school', time: '12:50' },
        { stop: 'gunma_univ_aramaki', time: '12:52' },
      ],
    },
    {
      route: '22A',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '13:17' }],
    },
    {
      route: '22M',
      destination: '群馬大学荒牧',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '13:41' }],
    },
    {
      route: '22A',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '13:50' }],
    },
    {
      route: '22A',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '14:16' }],
    },
    {
      route: '22L',
      destination: '道の駅まえばし赤城',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '14:33' }],
    },
    {
      route: '22B',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [
        { stop: 'driving_school', time: '14:50' },
        { stop: 'gunma_univ_aramaki', time: '14:52' },
      ],
    },
    {
      route: '22A',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '15:14' }],
    },
    {
      route: '22M',
      destination: '群馬大学荒牧',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '15:41' }],
    },
    {
      route: '22A',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '15:50' }],
    },
    {
      route: '22A',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '16:09' }],
    },
    {
      route: '22A',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '16:24' }],
    },
    {
      route: '22L',
      destination: '道の駅まえばし赤城',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '16:45' }],
    },
    {
      route: '22B',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [
        { stop: 'driving_school', time: '16:49' },
        { stop: 'gunma_univ_aramaki', time: '16:51' },
      ],
    },
    {
      route: '22A',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '17:17' }],
    },
    {
      route: '22B',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [
        { stop: 'driving_school', time: '18:00' },
        { stop: 'gunma_univ_aramaki', time: '18:02' },
      ],
    },
    {
      route: '22A',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '18:16' }],
    },
    {
      route: '22A',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '18:57' }],
    },
    {
      route: '22C',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '19:22' }],
    },
    {
      route: '22A',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '20:10' }],
    },
    {
      route: '22C',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '20:56' }],
    },
    {
      route: '22C',
      destination: '渋川駅',
      direction: 'shibukawa',
      departures: [{ stop: 'driving_school', time: '21:50' }],
    },
  ],
};

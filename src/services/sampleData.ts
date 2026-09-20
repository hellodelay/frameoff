import { Album, CachedPhoto } from '../types';

export const SAMPLE_ALBUM: Album = {
  id: 'sample_nature_showcase',
  title: 'Scenic Landscapes & Nature',
  coverPhotoBaseUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
  mediaItemsCount: 8,
  isSampleAlbum: true,
  lastSyncedAt: Date.now(),
  cachedCount: 8,
};

export interface SamplePhotoDef {
  id: string;
  filename: string;
  url: string;
  description: string;
  creationTime: string;
  width: number;
  height: number;
}

export const SAMPLE_PHOTOS_RAW: SamplePhotoDef[] = [
  {
    id: 'sample_1',
    filename: 'Yosemite_Valley_Dawn.jpg',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1920&q=85',
    description: 'Golden morning mist drifting across Yosemite Valley and majestic granite peaks.',
    creationTime: '2024-10-14T07:15:00Z',
    width: 1920,
    height: 1280,
  },
  {
    id: 'sample_2',
    filename: 'Swiss_Alps_Reflections.jpg',
    url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=85',
    description: 'Lush alpine valleys and emerald mountain reflections in Switzerland.',
    creationTime: '2024-09-22T14:40:00Z',
    width: 1920,
    height: 1280,
  },
  {
    id: 'sample_3',
    filename: 'Pacific_Coast_Sunset.jpg',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=85',
    description: 'Warm pastel sunset breaking over gentle waves on Big Sur coastline.',
    creationTime: '2024-08-18T19:25:00Z',
    width: 1920,
    height: 1280,
  },
  {
    id: 'sample_4',
    filename: 'Kyoto_Autumn_Foliage.jpg',
    url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1920&q=85',
    description: 'Vibrant crimson maple leaves framing an ancient pavilion in Kyoto.',
    creationTime: '2024-11-05T11:05:00Z',
    width: 1920,
    height: 1280,
  },
  {
    id: 'sample_5',
    filename: 'Norwegian_Fjords_Serenity.jpg',
    url: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?w=1920&q=85',
    description: 'Mirror-still waters surrounded by towering Nordic cliffs and waterfalls.',
    creationTime: '2024-07-30T16:50:00Z',
    width: 1920,
    height: 1280,
  },
  {
    id: 'sample_6',
    filename: 'Lavender_Fields_Provence.jpg',
    url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=85',
    description: 'Rolling violet lavender rows under soft golden hour light in Provence.',
    creationTime: '2024-06-25T18:10:00Z',
    width: 1920,
    height: 1280,
  },
  {
    id: 'sample_7',
    filename: 'Banff_Emerald_Lake.jpg',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=85',
    description: 'Crisp turquoise glacier water nestled deep in the Canadian Rockies.',
    creationTime: '2024-08-04T10:30:00Z',
    width: 1920,
    height: 1280,
  },
  {
    id: 'sample_8',
    filename: 'Aurora_Borealis_Iceland.jpg',
    url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=85',
    description: 'Emerald green northern lights illuminating a snowy mountain ridge.',
    creationTime: '2024-12-10T23:45:00Z',
    width: 1920,
    height: 1280,
  },
];

import { IMAGES } from '@/assets/images';
import { Campaign } from '../lib';

/**
 * Mock campaigns data representing various causes and categories
 * Using images defined in the project assets
 */
export const mockCampaigns: Campaign[] = [
  {
    id: 'c1',
    title: 'Future Scholars: Universal Education Initiative',
    slug: 'future-scholars-education',
    shortDescription: 'Providing essential learning materials and scholarships to underprivileged children worldwide.',
    description: 'The Future Scholars initiative aims to break the cycle of poverty by providing quality education to children in remote areas. Your contribution helps us build classrooms, provide books, and support teachers who are making a difference in the lives of thousands of students. We believe that education is a fundamental human right, not a privilege.',
    category: 'Education',
    goalAmount: 50000,
    currentAmount: 32450,
    donorCount: 420,
    image: IMAGES.CAMPAIGN_EDUCATION_1,
    endDate: '2026-12-31T23:59:59Z',
    organizer: {
      id: 'org1',
      name: 'Global Edu Fund',
      avatar: IMAGES.TESTIMONIALS_2,
      isVerified: true,
    },
    status: 'active',
  },
  {
    id: 'c2',
    title: 'Emergency Medical Support for Pediatric Care',
    slug: 'emergency-medical-support',
    shortDescription: 'Funding critical surgeries and medical equipment for children in urgent need.',
    description: 'Every second counts in medical emergencies. This campaign focuses on providing immediate financial support for complex pediatric surgeries that families otherwise could not afford. We work directly with specialized hospitals to ensure 100% of your donation goes to medical costs, saving lives one child at a time.',
    category: 'Medical',
    goalAmount: 75000,
    currentAmount: 58200,
    donorCount: 890,
    image: IMAGES.CAMPAIGN_MEDICAL_1,
    endDate: '2026-06-15T23:59:59Z',
    organizer: {
      id: 'org2',
      name: 'HealthCare Alliance',
      avatar: IMAGES.TESTIMONIALS_3,
      isVerified: true,
    },
    status: 'active',
  },
  {
    id: 'c3',
    title: 'Project Canopy: Restoring Global Rainforests',
    slug: 'project-canopy-reforestation',
    shortDescription: 'A massive reforestation project aiming to plant 1 million trees by the end of 2026.',
    description: 'Climate change is the challenge of our generation. Project Canopy is dedicated to restoring vital ecosystems by planting native tree species in deforested regions. Beyond planting, we employ local communities to monitor and protect these new forests for years to come, ensuring a sustainable future for our planet.',
    category: 'Environment',
    goalAmount: 25000,
    currentAmount: 12100,
    donorCount: 156,
    image: IMAGES.CAMPAIGN_ENVIRONMENT_1,
    endDate: '2026-11-20T23:59:59Z',
    organizer: {
      id: 'org3',
      name: 'Earth Guardians',
      isVerified: true,
    },
    status: 'active',
  },
  {
    id: 'c4',
    title: 'Rapid Response: Cyclone Recovery Mission',
    slug: 'cyclone-recovery-mission',
    shortDescription: 'Immediate aid for families displaced by recent extreme weather events.',
    description: 'The recent cyclone has left thousands without shelter or clean water. Our rapid response team is on the ground providing food kits, medical supplies, and temporary housing. This fund is dedicated to the long-term rebuilding of the community infrastructure and helping families regain their independence.',
    category: 'Disaster',
    goalAmount: 100000,
    currentAmount: 88900,
    donorCount: 1240,
    image: IMAGES.CAMPAIGN_DISASTER_1,
    endDate: '2026-04-30T23:59:59Z',
    organizer: {
      id: 'org4',
      name: 'Red Shield Aid',
      isVerified: true,
    },
    status: 'active',
  },
];

/**
 * Testimonial data for social proof and trust building
 */
export const mockTestimonials = [
  {
    id: 't1',
    name: 'Sarah Jenkins',
    role: 'Regular Donor',
    content: 'Fundy has completely changed how I think about giving. The transparency and ease of use make it my go-to platform for supporting causes I care about. Seeing the real-time progress of campaigns is incredibly rewarding and motivating.',
    avatar: IMAGES.TESTIMONIALS_2,
  },
  {
    id: 't2',
    name: 'Michael Rodriguez',
    role: 'Campaign Organizer',
    content: 'Launching our community garden project on Fundy was the best decision we made. The tools provided for sharing and donor engagement helped us reach our goal in half the time we expected. The support team is also fantastic!',
    avatar: IMAGES.TESTIMONIALS_3,
  },
  {
    id: 't3',
    name: 'Elena Liston',
    role: 'Impact Recipient',
    content: 'Thanks to the generous donors on Fundy, our village school now has a clean water system and a brand new computer lab. The impact on our children\'s education and health is immeasurable. We are forever grateful.',
    avatar: IMAGES.TESTIMONIALS_5,
  },
];

/**
 * Global statistics to showcase the platform\'s impact
 */
export const mockStats = [
  {
    id: 's1',
    label: 'Raised Worldwide',
    value: '$12.4M',
    description: 'Total funds distributed across 50+ countries.',
  },
  {
    id: 's2',
    label: 'Active Donors',
    value: '85,000+',
    description: 'A growing community of passionate changemakers.',
  },
  {
    id: 's3',
    label: 'Successful Campaigns',
    value: '1,240',
    description: 'Projects that reached or exceeded their funding goals.',
  },
];

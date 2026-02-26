# **App Name**: CongreKids

## Core Features:

- User Authentication & Roles: Secure Google Sign-In for parents and administrators. Manages user sessions and assigns initial 'parent' roles upon first login. Admin roles are managed manually.
- Child Profile Management: Parents can add, edit, and remove their children's names and birthdates, which are stored in their personal profiles.
- Meeting Management (Admin): Admins can create new meetings by defining the title, date, registration deadline, and custom age groups (label, min/max months) for childcare.
- Meeting Registration (Parent): Parents can view upcoming meetings, see the deadline, and select which of their registered children will attend using checkboxes. Displays a 'Plazo cerrado' message when the deadline passes.
- Registration Oversight & Export (Admin): Admins can view all registered children for a meeting, grouped by their assigned age groups, see total counts, and export this data to a CSV file.
- Dynamic Age Grouping Logic: Automatically calculates a child's age in months at the meeting date and assigns them to the appropriate, pre-defined age group. If no group matches, it assigns 'Sin grupo'.
- Historical View: Admins can view past meetings with their total registration counts. Parents can view their past registrations, including which children attended.

## Style Guidelines:

- Color scheme: Light. Primary: A serene, muted blue-green (#4DABAC) evoking calm and trustworthiness. Background: A very subtle, cool off-white with a hint of blue-green (#F2F6F6) for cleanliness and spaciousness. Accent: A fresh, vibrant green (#4FD48D) to highlight calls to action and important information.
- Headline and Body font: 'PT Sans' (humanist sans-serif) for a modern, friendly, and highly legible appearance suitable for both display and longer text blocks. The tone will be cercano y familiar (close and familiar).
- Use clear and friendly icons, favoring outlines over solid fills. Key icons include user avatar, logout, add/edit/delete for children, calendar for meetings, checkmark for registration, and export for data. Aim for universal understanding, consistent with the Spanish-first UI.
- Fully responsive and mobile-first, using Tailwind CSS for a clean, flexible grid. Features a simple top navbar with 'CongreKids' logo/name, user avatar, and logout. The Admin panel will utilize a sidebar navigation. Child profiles should be presented as cards, and meeting lists/registrations as organized tables or lists for easy readability.
- Incorporate subtle loading skeletons while fetching data to enhance user experience and provide visual feedback. Use gentle transitions for form submissions and view changes, ensuring a smooth and responsive interface.
# Fundy
Fundcrowding Platform Student Work


Use   
"npm install"  
"npm install ethers --save"  
for the first time
then  
"npm run dev"   
to open 
if still cannot  
"npm install @metamask/detect-provider"  
if nothings come out, please reload  
It will come out 

updated：  
Admin Acc is "admin123@gmail.com", password is "admin123"

attention !!!!!  
I will modify a bit, like create the campaign to chain not the db...!!!!


remain:  
- connect campaign ---> create contract
- donate function
- reward function
- the all link in the footer of web app
<<<<<<< HEAD
- cannot donate own campaign
- media upload in the post update in the campaign management
- First page a little bit big the things

=======

>>>>>>> 3f0d5b1934790b8867ae3c651e5c091c0012ab09

for the testing expired run below code
node scripts/simulate-expiry.mjs <campaign-id(get from supabase)>
example only dont use:
node scripts/simulate-expiry.mjs e10f8a17-b653-4b8b-a3d3-124aa89e839f

node scripts/reset-campaign.mjs e10f8a17-b653-4b8b-a3d3-124aa89e839f


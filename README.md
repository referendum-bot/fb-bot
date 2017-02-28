# fb-bot
This Facebook messenger bot was created as an entry into the Hack The Vote Hackathon which took place from 23-24 April 2016. Its purpose is to build engagement with young voters (18-25), who generally turn out less than any other demographic, by asking them for their opinions on various matters and telling them how to ensure that they are able to vote on the day. 

One of the key features is integration with the represent.me API to obtain questions which may help the young voter to decide who to vote for. 

![presenting the bot at Hack the Vote](https://pbs.twimg.com/media/Cgz_u7HWMAAXp2K.jpg:large)

## Getting Started
1. npm install body-parser express request 
2. Download and install ngrok from https://ngrok.com/download
3. ./ngrok http 8445
4. WIT_TOKEN=your_access_token FB_PAGE_ID=your_page_id FB_PAGE_TOKEN=your_page_token FB_VERIFY_TOKEN=verify_token node examples/messenger.js
5. Subscribe your page to the Webhooks using verify_token and `https://<your_ngrok_io>/fb` as callback URL.
6. Talk to your bot on Messenger!

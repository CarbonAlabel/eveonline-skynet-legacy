<?php
auth::requireToken();
comm::responseAdd("accessToken",getProperAccessToken(auth::getUserID()));
comm::responseAdd("userID",auth::getUserID());
comm::respond();
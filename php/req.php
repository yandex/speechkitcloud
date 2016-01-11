<?php

if (!function_exists('curl_file_create')) {
    function curl_file_create($filename, $mimetype = '', $postname = '') {
        return "@$filename;filename="
            . ($postname ?: basename($filename))
            . ($mimetype ? ";type=$mimetype" : '');
    }
}

function generateRandomSelection($min, $max, $count)
{
    $result=array();
    if($min>$max) return $result;
    $count=min(max($count,0),$max-$min+1);
    while(count($result)<$count) {
        $value=rand($min,$max-count($result));
        foreach($result as $used) if($used<=$value) $value++; else break;
        $result[]=dechex($value);
        sort($result);
    }
    shuffle($result);
    return $result;
}

function recognize($file, $key) {
    $uuid=generateRandomSelection(0,30,64);
    $uuid=implode($uuid);
    $uuid=substr($uuid,1,32);
    $curl = curl_init();
    $url = 'https://asr.yandex.net/asr_xml?'.http_build_query(array(
        'key'=>$key,
        'uuid' => $uuid,
        'topic' => 'notes',
        'lang'=>'ru-RU'
    ));
    curl_setopt($curl, CURLOPT_URL, $url);

    $data=file_get_contents(realpath($file));

    curl_setopt($curl, CURLOPT_POST, true);
    curl_setopt($curl, CURLOPT_POSTFIELDS, $data);
    curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, 0);
    curl_setopt($curl, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($curl, CURLOPT_HTTPHEADER, array('Content-Type: audio/x-wav'));
    curl_setopt($curl, CURLOPT_VERBOSE, true);
    $response = curl_exec($curl);
    $err = curl_errno($curl);
    curl_close($curl);
    if ($err)
        throw new exception("curl err $err");
    echo $response;
}


print_r($argv);
$filename = $argv[1];
$key = $argv[2];

recognize($filename, $key);
print("done\n");

?>

#include <iostream>
#include <string>
#include <sstream>
#include <curl/curl.h>
#include <assert.h>

// ./build/tts-curl-sample 123 6372dda5-9674-4413-85ff-e9d0eb2f99a7 | play -t wav -
// same as
// curl "tts.voicetech.yandex.net/generate?lang=ru_RU&format=wav&speaker=ermil&text=123&key=6372dda5-9674-4413-85ff-e9d0eb2f99a7" | play -t wav -

using namespace std;

const char* DEFAULT_HOST = "tts.voicetech.yandex.net";
const char* DEFAULT_LANG = "ru_RU";
const char* DEFAULT_FORMAT = "wav";
const char* DEFAULT_VOICE = "ermil";
const char* DEFAULT_TEXT = "123";
bool VERBOSE = false;

int debug_callback(CURL *handle,
    curl_infotype type,
    char *data,
    size_t size,
    void *userdata)
{
  if (type == CURLINFO_HEADER_OUT)
  {
    stringstream* s = (stringstream*)userdata;
    s->write(data, size);
  }
  return CURLE_OK;
}

size_t write_callback( void *ptr, size_t size, size_t nmemb, void *userdata)
{
  stringstream* s = (stringstream*)userdata;
  size_t fullSize = size*nmemb;
  s->write(static_cast<const char *>(ptr), fullSize);
  return fullSize;
}

size_t make_request(CURL* curl, const string& host, const string& text, const string& key)
{
  if (curl)
  {
    curl_easy_setopt(curl, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);

    stringstream urlStream;
    urlStream << host
      << "/generate?lang=" << DEFAULT_LANG
      << "&format=" << DEFAULT_FORMAT
      << "&speaker=" << DEFAULT_VOICE
      << "&text=" << text
      << "&key=" << key;

    if (VERBOSE) cout << urlStream.str() << endl;

    curl_easy_setopt(curl, CURLOPT_URL, urlStream.str().c_str());

    stringstream responseBodyStream;
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseBodyStream);

    stringstream requestStream;

    curl_easy_setopt(curl, CURLOPT_DEBUGFUNCTION, debug_callback);
    curl_easy_setopt(curl, CURLOPT_DEBUGDATA, &requestStream);
    curl_easy_setopt(curl, CURLOPT_VERBOSE, 1);

    CURLcode code = curl_easy_perform(curl);

    string request = requestStream.str();

    if (VERBOSE) cout << request.size() << endl << request << endl;

    unsigned httpCode;
    curl_easy_getinfo(curl, CURLINFO_HTTP_CODE, &httpCode);
    if (httpCode != 200)
    {
      if (VERBOSE) cout << "respose code is " << httpCode << endl;
    }

    cout << responseBodyStream.str();
  }
  return 0;
}

int  main(int argc, char* argv[])
{
  CURL *curl = NULL;
  curl = curl_easy_init();

  string text;
  string key;

  if (VERBOSE) cout << "argc=" << argc << endl;
  while (argc > 0)
  {
    int n = argc - 1;
    const char* val = argv[n];

    if (n == 2) key = val;
    if (n == 1) text = val;

    if (VERBOSE) cout << "argv[" << n << "]=" << val << endl;
    argc--;
  }

  if (text.empty() || key.empty())
  {
    cout << "Usage: tts-curl-sample <TEXT> <API_KEY>" << endl;
    return -1;
  }

  make_request(curl, DEFAULT_HOST, text, key);

  curl_easy_cleanup(curl);
  return 0;
}

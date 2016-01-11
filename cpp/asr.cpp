#include <iostream>
#include <fstream>
#include <string>
#include <sstream>
#include <curl/curl.h>

size_t write_response_data(char *ptr, size_t size, size_t nmemb, void *userdata)
{
  std::stringstream* s = (std::stringstream*)userdata;
  size_t n = size * nmemb;
  s->write(ptr, n);
  return n;
}

size_t read_request_data(char *ptr, size_t size, size_t nmemb, void *userdata)
{
  std::ifstream* f = (std::ifstream*)userdata;
  size_t n = size * nmemb;
  f->read(ptr, n);
  size_t result = f->gcount();
  return result;
}

int main(int argc, char** argv)
{
  std::string filename;
  std::string key;

  std::cout << "argc=" << argc << std::endl;
  while (argc > 0)
  {
    int n = argc - 1;
    const char* val = argv[n];

    if (n == 2) key = val;
    if (n == 1) filename = val;

    std::cout << "argv[" << n << "]=" << val << std::endl;
    argc--;
  }

  std::stringstream usage;
  usage << "Usage: "<< argv[0] << " <FILENAME> <API_KEY>";

  if (filename.empty() || key.empty())
  {
    std::cout << usage.str();
    return -1;
  }

  CURL *curl = NULL;
  curl = curl_easy_init();

  if (curl)
  {
    curl_easy_setopt(curl, CURLOPT_HEADER, 1);
    curl_easy_setopt(curl, CURLOPT_POST, 1);
    curl_easy_setopt(curl, CURLOPT_VERBOSE, 1);
    curl_easy_setopt(curl, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);

    struct curl_slist *headers=NULL;

    headers = curl_slist_append(headers, "Content-Type: audio/x-wav");
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    std::stringstream url;
    url << "asr.yandex.net/asr_xml?uuid=12345678123456781234567812345678&topic=general&lang=ru-RU&key="
        << key;

    curl_easy_setopt(curl, CURLOPT_URL, url.str().c_str());

    std::ifstream fileStream(filename, std::ifstream::binary);
    fileStream.seekg (0, fileStream.end);
    int length = fileStream.tellg();
    fileStream.seekg (0, fileStream.beg);

    curl_easy_setopt(curl, CURLOPT_READFUNCTION, &read_request_data);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, length);
    curl_easy_setopt(curl, CURLOPT_READDATA, &fileStream);

    std::stringstream contentStream;

    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, &write_response_data);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &contentStream);

    CURLcode code = curl_easy_perform(curl);

    unsigned httpCode;
    curl_easy_getinfo(curl, CURLINFO_HTTP_CODE, &httpCode);
    std::stringstream msg;
    msg << "Http code is " << httpCode;
    std::cout << contentStream.str();

    curl_free(headers);
    curl_easy_cleanup(curl);
  }

  return 0;
}
